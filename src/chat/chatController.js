/**
 * chatController.js
 * ──────────────────
 * High-level orchestrator: takes a user message, decides which webhook to
 * call (start vs. resume), manages loading state, and emits custom events
 * so the UI stays decoupled from the data layer.
 *
 * Events dispatched on `document`:
 *   'chat:message'      – { detail: messageObj }
 *   'chat:typing'       – { detail: { isTyping: boolean } }
 *   'chat:stateChange'  – { detail: { state: string } }
 *   'chat:error'        – { detail: { message: string, type: string } }
 */

import webhookService from '../services/webhookService.js';
import sessionManager from '../services/sessionManager.js';
import messageStore from './messageStore.js';
import config from '../config.js';

/* ── Helpers ──────────────────────────────────────────────── */

function emit(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

function friendlyError(err) {
  const map = {
    timeout: 'The server took too long to respond. Please try again.',
    offline: 'You appear to be offline. Check your connection and retry.',
    network: 'Unable to reach the server. Please check your connection.',
    server: 'Something went wrong on the server. Please try again later.',
  };
  return map[err.errorType] || 'An unexpected error occurred. Please try again.';
}

/* ── Public controller ───────────────────────────────────── */

const chatController = {
  /**
   * Send a user message and process the bot response.
   * @param {string} text
   */
  async send(text) {
    if (!text.trim()) return;
    if (sessionManager.isProcessing) return; // guard against double-sends

    // 1. Store & display user message
    const userMsg = messageStore.add('user', text.trim());
    emit('chat:message', userMsg);

    // 2. Transition to processing
    sessionManager.setProcessing();
    emit('chat:stateChange', { state: 'processing' });
    emit('chat:typing', { isTyping: true });

    try {
      // 3. Decide which webhook to call
      let result;
      let streamingMsgId = null;
      let currentText = '';

      const onChunk = (chunkText) => {
        if (!streamingMsgId) {
          emit('chat:typing', { isTyping: false });
          const tempMsg = messageStore.add('bot', chunkText, null);
          streamingMsgId = tempMsg.id;
          currentText = chunkText;
          emit('chat:message', tempMsg);
        } else {
          currentText += chunkText;
          emit('chat:messageUpdate', { id: streamingMsgId, content: currentText });
        }
      };

      if (sessionManager.hasActiveExecution) {
        result = await webhookService.resumeChat(
          sessionManager.sessionId,
          sessionManager.executionId,
          text.trim(),
          sessionManager.resumeUrl,
          onChunk
        );
      } else {
        result = await webhookService.startChat(
          sessionManager.sessionId,
          text.trim(),
          onChunk
        );
      }

      // 5. Update session state
      sessionManager.handleResponse(result);

      if (streamingMsgId) {
        // True streaming was used
        messageStore.update(streamingMsgId, {
          content: result.response,
          metadata: {
            executionId: result.executionId,
            waitingForInput: result.waitingForInput,
          }
        });
        emit('chat:messageUpdate', { id: streamingMsgId, content: result.response });
      } else {
        // Backend didn't stream (e.g. sent application/json).
        // Simulate a ChatGPT typewriter effect.
        emit('chat:typing', { isTyping: false });
        
        const botMsg = messageStore.add('bot', '', null);
        emit('chat:message', botMsg);

        let simulatedText = '';
        const chars = Array.from(result.response || '');
        
        // Write chunks of 3 chars for a nice fast 60fps feel (or adjust by config)
        for (let i = 0; i < chars.length; i += 3) {
          simulatedText += chars.slice(i, i + 3).join('');
          emit('chat:messageUpdate', { id: botMsg.id, content: simulatedText });
          await new Promise(r => setTimeout(r, 10)); // ~10ms delay between prints
        }

        // Final update with exact text and metadata
        messageStore.update(botMsg.id, {
          content: result.response,
          metadata: {
            executionId: result.executionId,
            waitingForInput: result.waitingForInput,
          }
        });
        emit('chat:messageUpdate', { id: botMsg.id, content: result.response });
      }

      emit('chat:stateChange', { state: sessionManager.state });
    } catch (err) {
      console.error('[chatController]', err);
      emit('chat:typing', { isTyping: false });

      const errorText = friendlyError(err);
      const sysMsg = messageStore.add('system', errorText);
      emit('chat:message', sysMsg);

      // Revert to previous state so user can retry
      sessionManager.handleResponse({
        waitingForInput: sessionManager.hasActiveExecution,
        executionId: sessionManager.executionId,
        resumeUrl: sessionManager.resumeUrl,
      });
      emit('chat:stateChange', { state: sessionManager.state });
    }
  },

  /**
   * Reset everything and start a fresh conversation.
   */
  reset() {
    sessionManager.reset();
    messageStore.clear();
    emit('chat:stateChange', { state: 'idle' });
  },

  /**
   * Restore messages from localStorage on app startup.
   */
  restore() {
    const saved = messageStore.getAll();
    saved.forEach((msg) => emit('chat:message', msg));
    emit('chat:stateChange', { state: sessionManager.state });
  },
};

export default chatController;
