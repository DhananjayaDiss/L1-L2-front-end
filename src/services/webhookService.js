/**
 * webhookService.js
 * ─────────────────
 * Low-level HTTP layer that talks to the n8n webhooks.
 * Each public method returns a normalised response object:
 *
 *   { response: string, waitingForInput: boolean, executionId: string|null }
 *
 * Includes automatic retry with exponential back-off and request logging.
 */

import config from '../config.js';
import sessionManager from './sessionManager.js';

/* ── Helpers ──────────────────────────────────────────────── */

/**
 * Classify an error so the caller can decide whether to show a
 * "check your network" message vs. "something went wrong on the server".
 */
function classifyError(error) {
  if (error.name === 'AbortError') return 'timeout';
  if (!navigator.onLine) return 'offline';
  if (error instanceof TypeError) return 'network'; // fetch network errors
  return 'server';
}

/**
 * Sleep helper for retry back-off.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalise whatever the n8n webhook returns into a consistent shape.
 * Handles both single-object and array responses from n8n.
 */
function normaliseResponse(data) {
  // n8n sometimes wraps in an array
  const payload = Array.isArray(data) ? data[0] : data;

  // Try common field names n8n workflows use for the bot response
  const response =
    payload?.display_text ??
    payload?.response ??
    payload?.message ??
    payload?.output ??
    payload?.text ??
    (typeof payload === 'string' ? payload : JSON.stringify(payload ?? ''));

  // executionId can live at top level or inside $execution
  const executionId =
    payload?.executionId ??
    payload?.$execution?.id ??
    null;

  const resumeUrl = payload?.resumeUrl ?? null;

  return {
    response,
    waitingForInput: Boolean(payload?.waitingForInput || resumeUrl !== null),
    executionId,
    resumeUrl,
  };
}

/* ── Core fetch with retry ───────────────────────────────── */

/**
 * Internal fetch wrapper with timeout + retry logic.
 * @param {string}  url
 * @param {object}  body
 * @param {number} [attempt=0]
 * @param {Function} [onChunk=null]
 * @returns {Promise<object>}
 */
async function request(url, body, attempt = 0, onChunk = null) {
  const controller = new AbortController();
  // We only time out the connection/first byte. For long streams, we remove the timer once headers arrive.
  const timer = setTimeout(() => controller.abort(), config.network.timeout);

  try {
    console.log(`[webhook] → ${url}`, body);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson')) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalResponse = '';
      let executionId = null;
      let resumeUrl = null;
      let waitingForInput = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          let lines = buffer.split('\n');
          buffer = lines.pop() || ''; // keep incomplete line

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.startsWith('data: ')) {
              const dataStr = trimmedLine.slice(6).trim();
              if (dataStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(dataStr);
                
                // Extract common n8n chat streaming fields
                let chunkText = '';
                if (parsed.text !== undefined) chunkText = parsed.text;
                else if (parsed.response !== undefined) chunkText = parsed.response;
                else if (parsed.message !== undefined) chunkText = parsed.message;
                else if (parsed.output !== undefined) chunkText = parsed.output;
                else if (typeof parsed === 'string') chunkText = parsed;

                // Extract metadata if n8n exposes it during the stream
                if (parsed.executionId) executionId = parsed.executionId;
                if (parsed.resumeUrl !== undefined) resumeUrl = parsed.resumeUrl;
                if (parsed.waitingForInput !== undefined) waitingForInput = parsed.waitingForInput;

                if (chunkText) {
                  finalResponse += chunkText;
                  if (onChunk) onChunk(chunkText);
                }
              } catch (e) {
                // Not JSON, just append raw data
                finalResponse += dataStr;
                if (onChunk) onChunk(dataStr);
              }
            } else if (contentType.includes('application/x-ndjson') || trimmedLine.startsWith('{')) {
              // Handle NDJSON format just in case
              try {
                const parsed = JSON.parse(trimmedLine);
                let chunkText = parsed.text || parsed.response || parsed.message || parsed.output || '';
                
                if (parsed.executionId) executionId = parsed.executionId;
                if (parsed.resumeUrl !== undefined) resumeUrl = parsed.resumeUrl;
                if (parsed.waitingForInput !== undefined) waitingForInput = parsed.waitingForInput;

                if (chunkText) {
                  finalResponse += chunkText;
                  if (onChunk) onChunk(chunkText);
                }
              } catch (e) {
                // Not standard obj
              }
            }
          }
        }
      }

      // Append anything leftover in buffer if it's not a protocol marker
      if (buffer.trim().startsWith('data: ')) {
         const remainder = buffer.trim().slice(6);
         if (remainder !== '[DONE]') {
            finalResponse += remainder;
            if (onChunk) onChunk(remainder);
         }
      }

      return {
        response: finalResponse,
        waitingForInput,
        executionId,
        resumeUrl
      };
    } else {
      const data = await res.json();
      console.log(`[webhook] ← `, data);
      return normaliseResponse(data);
    }
  } catch (err) {
    clearTimeout(timer);

    const errorType = classifyError(err);

    // Retry on transient errors
    if (attempt < config.network.maxRetries && (errorType === 'network' || errorType === 'timeout')) {
      const delay = config.network.retryBaseDelay * 2 ** attempt;
      console.warn(`[webhook] Retry ${attempt + 1}/${config.network.maxRetries} in ${delay}ms`, err.message);
      await sleep(delay);
      return request(url, body, attempt + 1, onChunk);
    }

    err.errorType = errorType;
    throw err;
  }
}

/* ── Public API ──────────────────────────────────────────── */

const webhookService = {
  /**
   * Start a brand-new chat workflow execution.
   * @param {string} sessionId
   * @param {string} message – the user's first message
   * @param {Function} [onChunk] - callback for streaming chunks
   * @returns {Promise<{response:string, waitingForInput:boolean, executionId:string|null}>}
   */
  async startChat(sessionId, message, onChunk = null) {
    return request(config.webhooks.start, { sessionId, userId: sessionManager.userId, message }, 0, onChunk);
  },

  /**
   * Resume a paused workflow execution (after a Wait node).
   * @param {string} sessionId
   * @param {string} executionId – returned by the previous response
   * @param {string} message – follow-up user input
   * @param {string} [resumeUrl] – dynamic URL to post the resume data to
   * @param {Function} [onChunk] - callback for streaming chunks
   * @returns {Promise<{response:string, waitingForInput:boolean, executionId:string|null, resumeUrl:string|null}>}
   */
  async resumeChat(sessionId, executionId, message, resumeUrl = null, onChunk = null) {
    const url = resumeUrl || config.webhooks.resume;
    return request(url, { sessionId, executionId, userId: sessionManager.userId, message }, 0, onChunk);
  },
};

export default webhookService;
