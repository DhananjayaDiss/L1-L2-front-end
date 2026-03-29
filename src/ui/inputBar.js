/**
 * inputBar.js
 * ────────────
 * Message input area with auto-expanding textarea, send button,
 * and keyboard shortcuts (Enter to send, Shift+Enter for newline).
 */

class InputBar {
  /**
   * @param {HTMLElement} container – element to render into
   * @param {(text: string) => void} onSend – callback when user sends a message
   */
  constructor(container, onSend) {
    this.container = container;
    this.onSend = onSend;
    this.disabled = false;

    this.render();
    this.bindEvents();
  }

  render() {
    this.el = document.createElement('div');
    this.el.classList.add('input-bar');
    this.el.id = 'input-bar';

    this.textarea = document.createElement('textarea');
    this.textarea.classList.add('input-bar__textarea');
    this.textarea.id = 'chat-input';
    this.textarea.placeholder = 'Type your message…';
    this.textarea.rows = 1;
    this.textarea.setAttribute('aria-label', 'Message input');

    this.sendBtn = document.createElement('button');
    this.sendBtn.classList.add('input-bar__send');
    this.sendBtn.id = 'send-button';
    this.sendBtn.type = 'button';
    this.sendBtn.setAttribute('aria-label', 'Send message');
    this.sendBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    `;

    this.el.appendChild(this.textarea);
    this.el.appendChild(this.sendBtn);
    
    this.container.appendChild(this.el);
  }

  bindEvents() {
    // Send on Enter (Shift+Enter for newline)
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Send button click
    this.sendBtn.addEventListener('click', () => this.handleSend());

    // Auto-expand textarea and toggle button state
    this.textarea.addEventListener('input', () => {
      this.autoResize();
      this.updateSendButtonState();
    });

    // Initial state
    this.updateSendButtonState();
  }

  updateSendButtonState() {
    if (this.disabled) return;
    const text = this.textarea.value.trim();
    this.sendBtn.disabled = text.length === 0;
  }

  handleSend() {
    if (this.disabled) return;
    const text = this.textarea.value.trim();
    if (!text) return;

    this.onSend(text);
    this.textarea.value = '';
    this.autoResize();
    this.updateSendButtonState();
    this.textarea.focus();
  }

  autoResize() {
    this.textarea.style.height = 'auto';
    const maxHeight = 150; // px
    this.textarea.style.height = Math.min(this.textarea.scrollHeight, maxHeight) + 'px';
  }

  /** Disable input while the bot is processing. */
  setDisabled(disabled) {
    this.disabled = disabled;
    this.textarea.disabled = disabled;
    
    if (disabled) {
      this.sendBtn.disabled = true;
    } else {
      this.updateSendButtonState();
      this.textarea.focus();
    }
    this.el.classList.toggle('input-bar--disabled', disabled);
  }

  /** Focus the textarea. */
  focus() {
    this.textarea.focus();
  }
}

export default InputBar;
