/**
 * main.js
 * ────────
 * Application bootstrap.  Mounts all UI components, wires up events,
 * and restores any persisted session.
 */

import './styles/index.css';
import './styles/chat.css';

import chatController from './chat/chatController.js';
import ChatWindow from './ui/chatWindow.js';
import InputBar from './ui/inputBar.js';
import StatusBar from './ui/statusBar.js';
import Header from './ui/header.js';
import config from './config.js';

/* ── Mount UI ────────────────────────────────────────────── */

const app = document.getElementById('app');

// Header
const headerContainer = document.createElement('div');
app.appendChild(headerContainer);
new Header(headerContainer, handleNewChat);

// Status bar will be added later

// Chat body (scrollable area containing messages)
const chatBody = document.createElement('div');
chatBody.classList.add('chat-body');
chatBody.id = 'chat-body';
app.appendChild(chatBody);
const chatWindow = new ChatWindow(chatBody);

// Input bar
const inputWrapper = document.createElement('div');
inputWrapper.classList.add('input-bar-wrapper');
app.appendChild(inputWrapper);
const inputBar = new InputBar(inputWrapper, handleSend);

// Status bar (now at the bottom)
if (config.features.showStatusBar) {
  const statusContainer = document.createElement('div');
  app.appendChild(statusContainer);
  new StatusBar(statusContainer);
}

/* ── Event wiring ────────────────────────────────────────── */

/** Disable input while processing, re-enable when done. */
document.addEventListener('chat:stateChange', (e) => {
  const processing = e.detail.state === 'processing';
  inputBar.setDisabled(processing);
});

async function handleSend(text) {
  await chatController.send(text);
}

function handleNewChat() {
  chatController.reset();
  chatWindow.clear();
}

/* ── Restore previous session (if any) ───────────────────── */
chatController.restore();
inputBar.focus();
