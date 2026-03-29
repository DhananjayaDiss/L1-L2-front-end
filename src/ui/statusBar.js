/**
 * statusBar.js
 * ─────────────
 * Visual indicator for connection/workflow state.
 * Shows a coloured dot + label that updates reactively.
 */

class StatusBar {
  constructor(container) {
    this.container = container;
    this.render();

    document.addEventListener('chat:stateChange', (e) => {
      this.update(e.detail.state);
    });
  }

  render() {
    this.el = document.createElement('div');
    this.el.classList.add('status-bar');
    this.el.id = 'status-bar';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');

    const statusLeft = document.createElement('div');
    statusLeft.classList.add('status-bar__left');

    this.dot = document.createElement('span');
    this.dot.classList.add('status-bar__dot');

    this.label = document.createElement('span');
    this.label.classList.add('status-bar__label');
    
    statusLeft.appendChild(this.dot);
    statusLeft.appendChild(this.label);

    const disclaimerMiddle = document.createElement('div');
    disclaimerMiddle.classList.add('status-bar__middle');
    disclaimerMiddle.textContent = 'SLT Help Desk Assistant can make mistakes.';

    const statusRight = document.createElement('div');
    statusRight.classList.add('status-bar__right');
    // empty to balance flexbox

    this.el.appendChild(statusLeft);
    this.el.appendChild(disclaimerMiddle);
    this.el.appendChild(statusRight);
    
    this.container.appendChild(this.el);

    this.update('idle');
  }

  update(state) {
    const states = {
      idle: { label: 'Ready', color: 'var(--color-success)' },
      processing: { label: 'Processing…', color: 'var(--color-warning)' },
      waitingForInput: { label: 'Waiting for your input', color: 'var(--color-info)' },
    };

    const s = states[state] || states.idle;
    this.dot.style.backgroundColor = s.color;
    this.label.textContent = s.label;
    this.el.dataset.state = state;
  }
}

export default StatusBar;
