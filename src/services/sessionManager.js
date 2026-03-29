/**
 * sessionManager.js
 * ─────────────────
 * Tracks the current chat session: unique session ID, latest execution ID,
 * and workflow state.  Persists to localStorage so a page refresh doesn't
 * lose the running conversation.
 *
 * Workflow states:
 *   idle            → no active workflow
 *   processing      → request in flight, waiting for n8n
 *   waitingForInput → n8n paused at a Wait node, expecting user input
 */

const STORAGE_KEY = 'n8n_chat_session';
const USER_ID_KEY  = 'n8n_chat_user_id';

/**
 * Generate a short unique ID (good enough for session tracking).
 */
function generateId(prefix = 'sess') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get or create a persistent userId that survives resets.
 */
function getOrCreateUserId() {
  try {
    const stored = localStorage.getItem(USER_ID_KEY);
    if (stored) return stored;
    const id = generateId('user');
    localStorage.setItem(USER_ID_KEY, id);
    return id;
  } catch {
    return generateId('user');
  }
}

/* ── Session state ───────────────────────────────────────── */

/** @type {{ sessionId: string, executionId: string|null, resumeUrl: string|null, state: string }} */
let session = loadFromStorage() || createFreshSession();

function createFreshSession() {
  return {
    sessionId: generateId(),
    executionId: null,
    resumeUrl: null,
    state: 'idle', // 'idle' | 'processing' | 'waitingForInput'
  };
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* quota exceeded – non-critical */
  }
}

/* ── Public API ──────────────────────────────────────────── */

const sessionManager = {
  /** Persistent user ID (survives session resets). */
  get userId() {
    return getOrCreateUserId();
  },

  /** Current session ID (always available). */
  get sessionId() {
    return session.sessionId;
  },

  /** Latest execution ID from n8n (null if workflow hasn't started). */
  get executionId() {
    return session.executionId;
  },

  /** Latest resume URL if provided by n8n. */
  get resumeUrl() {
    return session.resumeUrl;
  },

  /** Current workflow state string. */
  get state() {
    return session.state;
  },

  /** True when the workflow is paused, waiting for user input. */
  get isWaitingForInput() {
    return session.state === 'waitingForInput';
  },

  /** True when a request is currently in-flight. */
  get isProcessing() {
    return session.state === 'processing';
  },

  /** True when no workflow is active (first message or after reset). */
  get isIdle() {
    return session.state === 'idle';
  },

  /** Whether a workflow execution has been started (executionId or resumeUrl exists). */
  get hasActiveExecution() {
    return session.executionId !== null || session.resumeUrl != null;
  },

  /* ── Mutations ──────────────────────────────────────────── */

  /**
   * Mark that we're about to send a request.
   */
  setProcessing() {
    session.state = 'processing';
    persist();
  },

  /**
   * Update session after receiving a webhook response.
   * @param {{ waitingForInput: boolean, executionId: string|null, resumeUrl: string|null }} result
   */
  handleResponse(result) {
    if (result.executionId !== undefined && result.executionId !== null) {
      session.executionId = result.executionId;
    }
    if (result.resumeUrl !== undefined && result.resumeUrl !== null) {
      session.resumeUrl = result.resumeUrl;
    }
    if (!result.waitingForInput) {
      session.executionId = null;
      session.resumeUrl = null;
    }
    session.state = result.waitingForInput ? 'waitingForInput' : 'idle';
    persist();
  },

  /**
   * Reset everything for a brand-new conversation.
   */
  reset() {
    session = createFreshSession();
    persist();
  },
};

export default sessionManager;
