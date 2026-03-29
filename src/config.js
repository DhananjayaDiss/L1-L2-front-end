/**
 * Application configuration.
 * Webhook URLs and runtime settings are centralised here.
 * In production, values come from environment variables injected at build time.
 */

const config = Object.freeze({
  /* ── Webhook endpoints ─────────────────────────────────── */
  webhooks: {
    /** First webhook – kicks off a brand-new workflow execution */
    start: import.meta.env.VITE_WEBHOOK_START_URL || 'https://your-n8n-instance.com/webhook/chat-start',
    /** Second webhook – resumes an execution paused at a Wait node */
    resume: import.meta.env.VITE_WEBHOOK_RESUME_URL || 'https://your-n8n-instance.com/webhook/chat-resume',
  },

  /* ── Network / retry ───────────────────────────────────── */
  network: {
    /** Request timeout in milliseconds */
    timeout: 120_000,
    /** Maximum number of automatic retries on failure */
    maxRetries: 3,
    /** Base delay (ms) for exponential back-off between retries */
    retryBaseDelay: 1000,
  },

  /* ── UI behaviour ──────────────────────────────────────── */
  ui: {
    /** Simulated typing speed – delay per character (ms) */
    typingSpeed: 18,
    /** Minimum time the "typing …" indicator stays visible (ms) */
    minTypingDuration: 600,
    /** Maximum number of messages kept in local storage */
    maxStoredMessages: 500,
    /** Phrases to cycle through while waiting for the bot reply */
    loadingPhrases: [
      'Processing...',
      'Searching the database...',
      'Calling AI agents...',
      'Analyzing data...',
      'Formulating response...',
      'Almost there...'
    ],
  },

  /* ── Feature flags ─────────────────────────────────────── */
  features: {
    /** Persist chat history in localStorage */
    persistMessages: true,
    /** Show a connection-status bar at the top */
    showStatusBar: true,
    /** Enable markdown-like formatting in bot messages */
    enableMarkdown: true,
    /** Enable sound notification for new messages */
    enableSounds: false,
  },
});

export default config;
