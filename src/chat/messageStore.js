/**
 * messageStore.js
 * ────────────────
 * In-memory message list backed by localStorage.
 * Each message follows a consistent schema so the UI doesn't need to
 * worry about data shape.
 *
 * Message schema:
 *   { id, role, content, timestamp, metadata? }
 *
 * Roles:  'user' | 'bot' | 'system'
 */

import config from '../config.js';

const STORAGE_KEY = 'n8n_chat_messages';

let messages = loadFromStorage();

/* ── Persistence helpers ─────────────────────────────────── */

function loadFromStorage() {
  if (!config.features.persistMessages) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist() {
  if (!config.features.persistMessages) return;
  try {
    // Keep only the most recent N messages to avoid quota issues
    const toStore = messages.slice(-config.ui.maxStoredMessages);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    /* quota exceeded – non-critical */
  }
}

/* ── Unique ID ───────────────────────────────────────────── */

let counter = 0;
function nextId() {
  return `msg_${Date.now().toString(36)}_${(counter++).toString(36)}`;
}

/* ── Public API ──────────────────────────────────────────── */

const messageStore = {
  /**
   * Add a message and persist.
   * @param {'user'|'bot'|'system'} role
   * @param {string} content
   * @param {object} [metadata] – optional extra data (e.g. executionId)
   * @returns {object} the created message object
   */
  add(role, content, metadata = null) {
    const msg = {
      id: nextId(),
      role,
      content,
      timestamp: Date.now(),
      ...(metadata && { metadata }),
    };
    messages.push(msg);
    persist();
    return msg;
  },

  /**
   * Update an existing message.
   * @param {string} id 
   * @param {object} updates 
   */
  update(id, updates) {
    const msg = messages.find(m => m.id === id);
    if (!msg) return null;
    Object.assign(msg, updates);
    persist();
    return msg;
  },

  /** Return a shallow copy of the full message list. */
  getAll() {
    return [...messages];
  },

  /** Number of messages. */
  get length() {
    return messages.length;
  },

  /** Clear everything (new conversation). */
  clear() {
    messages = [];
    persist();
  },
};

export default messageStore;
