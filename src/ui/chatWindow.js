/**
 * chatWindow.js
 * ──────────────
 * Renders the message list, typing indicator, and handles auto-scroll.
 * Listens for 'chat:message' and 'chat:typing' events.
 */

import config from '../config.js';

/* ── Markdown-lite renderer ──────────────────────────────── */

function renderContent(text) {
  if (!config.features.enableMarkdown) return escapeHtml(text);

  let html = escapeHtml(text);

  // Code blocks ```...```
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  // Inline code `...`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold **...**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic *...*  (single * not preceded/followed by *)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );
  // Unordered lists: lines starting with "- "
  html = html.replace(/(?:^|\n)- (.+)/g, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  // Collapse adjacent </ul><ul> from multiple items
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // Paragraph breaks (double newlines) → proper spacing
  html = html.replace(/\n\n+/g, '</p><p>');
  // Remaining single newlines → line breaks
  html = html.replace(/\n/g, '<br>');
  // Wrap in paragraph
  html = '<p>' + html + '</p>';
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ── DOM builders ────────────────────────────────────────── */

function createMessageBubble(msg) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', `message--${msg.role}`);
  wrapper.dataset.id = msg.id;

  // Avatar
  const avatar = document.createElement('div');
  avatar.classList.add('message__avatar');
  if (msg.role === 'bot') {
    const img = document.createElement('img');
    img.src = '/bot-avatar.png';
    img.alt = 'AI';
    img.classList.add('message__avatar-img');
    avatar.appendChild(img);
  } else {
    avatar.textContent = msg.role === 'user' ? '👤' : 'ℹ️';
  }

  // Bubble
  const bubble = document.createElement('div');
  bubble.classList.add('message__bubble');
  bubble.innerHTML = renderContent(msg.content);

  // Time
  const time = document.createElement('span');
  time.classList.add('message__time');
  time.textContent = formatTime(msg.timestamp);

  // Assemble
  const row = document.createElement('div');
  row.classList.add('message__row');
  row.appendChild(avatar);

  const col = document.createElement('div');
  col.classList.add('message__col');
  col.appendChild(bubble);
  col.appendChild(time);
  row.appendChild(col);

  wrapper.appendChild(row);
  return wrapper;
}

function createTypingIndicator() {
  const el = document.createElement('div');
  el.classList.add('typing-indicator');
  el.id = 'typing-indicator';
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="message__row">
      <div class="message__avatar">
        <img src="/bot-avatar.png" alt="AI" class="message__avatar-img" />
      </div>
      <div class="processing-animation">
        <div class="processing-animation__content">
          
          <svg class="processing-animation__lines" viewBox="0 0 120 24" fill="none">
            <path class="data-line data-line--1" d="M10 12 Q30 4 60 12 Q90 20 110 12" stroke="url(#lineGrad)" stroke-width="1.5" />
            <path class="data-line data-line--2" d="M10 12 Q30 20 60 12 Q90 4 110 12" stroke="url(#lineGrad)" stroke-width="1" />
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.2" />
                <stop offset="50%" stop-color="var(--color-accent)" stop-opacity="0.8" />
                <stop offset="100%" stop-color="var(--color-success)" stop-opacity="0.2" />
              </linearGradient>
            </defs>
          </svg>
          <span class="processing-animation__label">Processing</span>
        </div>
      </div>
    </div>
  `;
  el.hidden = true;
  return el;
}

/* ── Chat Window class ───────────────────────────────────── */

class ChatWindow {
  constructor(container) {
    this.container = container;

    // Message list
    this.messageList = document.createElement('div');
    this.messageList.classList.add('chat-messages');
    this.messageList.id = 'chat-messages';
    this.messageList.setAttribute('role', 'log');
    this.messageList.setAttribute('aria-label', 'Chat messages');

    // Welcome message
    this.welcome = document.createElement('div');
    this.welcome.classList.add('chat-welcome');
    this.welcome.id = 'chat-welcome';
    this.welcome.innerHTML = `
      <img src="/SLTMobitel_Logo.svg" alt="SLT Logo" class="chat-welcome__icon" style="height: 64px; margin-bottom: 24px;" />
      <h2 class="chat-welcome__title">How can I help you today?</h2>
      <p class="chat-welcome__text">Start a conversation with the Sri Lanka Telecom Help Desk Assistant.</p>
    `;

    // Typing indicator
    this.typingEl = createTypingIndicator();

    // State for typing indicator
    this.typingInterval = null;
    this.typingPhraseIndex = 0;

    // Assemble
    this.container.appendChild(this.welcome);
    this.container.appendChild(this.messageList);
    this.container.appendChild(this.typingEl);

    // Listen to events
    document.addEventListener('chat:message', (e) => this.onMessage(e.detail));
    document.addEventListener('chat:messageUpdate', (e) => this.onMessageUpdate(e.detail));
    document.addEventListener('chat:typing', (e) => this.onTyping(e.detail));
  }

  onMessageUpdate({ id, content }) {
    const bubbleWrapper = this.messageList.querySelector(`.message[data-id="${id}"]`);
    if (bubbleWrapper) {
      const bubble = bubbleWrapper.querySelector('.message__bubble');
      if (bubble) {
        bubble.innerHTML = renderContent(content);
        // Only auto-scroll if we're already near the bottom
        const isNearBottom = this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight < 150;
        if (isNearBottom) this.scrollToBottom();
      }
    }
  }

  onMessage(msg) {
    // Hide welcome on first message
    if (this.welcome && !this.welcome.hidden) {
      this.welcome.hidden = true;
    }

    const bubble = createMessageBubble(msg);
    this.messageList.appendChild(bubble);

    // Animate entrance
    requestAnimationFrame(() => {
      bubble.classList.add('message--visible');
      this.scrollToBottom();
    });
  }

  onTyping({ isTyping }) {
    this.typingEl.hidden = !isTyping;
    const label = this.typingEl.querySelector('.processing-animation__label');

    if (isTyping) {
      const phrases = config.ui.loadingPhrases || ['Processing...'];
      label.textContent = phrases[0];
      this.typingPhraseIndex = 0;

      if (phrases.length > 1) {
        this.typingInterval = setInterval(() => {
          this.typingPhraseIndex = (this.typingPhraseIndex + 1) % phrases.length;
          label.textContent = phrases[this.typingPhraseIndex];
        }, 3000); // cycle every 3 seconds
      }
      this.scrollToBottom();
    } else {
      if (this.typingInterval) {
        clearInterval(this.typingInterval);
        this.typingInterval = null;
      }
    }
  }

  scrollToBottom() {
    this.container.scrollTo({
      top: this.container.scrollHeight,
      behavior: 'smooth',
    });
  }

  /** Clear the DOM (for "new chat"). */
  clear() {
    this.messageList.innerHTML = '';
    this.welcome.hidden = false;
  }
}

export default ChatWindow;
