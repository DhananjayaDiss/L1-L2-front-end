/**
 * header.js
 * ──────────
 * Top bar with app title and "New Chat" button.
 */

class Header {
  /**
   * @param {HTMLElement} container
   * @param {() => void} onNewChat
   */
  constructor(container, onNewChat) {
    this.container = container;
    this.onNewChat = onNewChat;
    this.render();
  }

  render() {
    this.el = document.createElement('header');
    this.el.classList.add('app-header');
    this.el.id = 'app-header';

    // Left: logo + title
    const brand = document.createElement('div');
    brand.classList.add('app-header__brand');
    brand.innerHTML = `
      <img src="/SLTMobitel_Logo.svg" alt="SLT Logo" class="app-header__logo" style="height: 32px; width: auto;" />
      <h1 class="app-header__title">Sri Lanka Telecom Help Desk Assistant</h1>
    `;

    // Right: new chat button
    const actions = document.createElement('div');
    actions.classList.add('app-header__actions');

    this.newChatBtn = document.createElement('button');
    this.newChatBtn.classList.add('btn', 'btn--ghost');
    this.newChatBtn.id = 'new-chat-button';
    this.newChatBtn.type = 'button';
    this.newChatBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      New Chat
    `;
    this.newChatBtn.addEventListener('click', () => this.onNewChat());

    actions.appendChild(this.newChatBtn);
    this.el.appendChild(brand);
    this.el.appendChild(actions);
    this.container.appendChild(this.el);
  }
}

export default Header;
