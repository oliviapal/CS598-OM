// confirm-popup.js
// A lightweight confirmation popup to review an improved suggestion

export class ConfirmPopup {
    constructor() {
        this.popup = null;
        this.targetElement = null;
        this.suggestionText = '';
        this.escHandler = null;
    }

    show(suggestionText, targetElement = null) {
        this.suggestionText = suggestionText || '';
        this.targetElement = targetElement || null;

        // Clean up any existing confirm popup first
        if (this.popup) {
            this.hide();
        }

        // Create container
        this.popup = document.createElement('div');
        this.popup.className = 'socially-popup socially-confirm-popup';

        // Content
        this.popup.innerHTML = `
            <div class="socially-popup-header">
                <h3>Use this improved suggestion?</h3>
                <button class="socially-close-btn" title="Close">&times;</button>
            </div>
            <div class="socially-popup-body">
                <div class="socially-suggestion">
                    <div class="suggestion-text">${this.escapeHtml(this.suggestionText)}</div>
                </div>
                <div class="socially-action-buttons">
                    <button class="socially-accept-btn" title="Accept suggestion">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Accept
                    </button>
                    <button class="socially-dismiss-btn" title="Dismiss">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Dismiss
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.popup);

        // Wire events
        const closeBtn = this.popup.querySelector('.socially-close-btn');
        closeBtn.addEventListener('click', () => this.dismissAndRefocus());

        const acceptBtn = this.popup.querySelector('.socially-accept-btn');
        acceptBtn.addEventListener('click', () => this.accept());

        const dismissBtn = this.popup.querySelector('.socially-dismiss-btn');
        dismissBtn.addEventListener('click', () => this.dismissAndRefocus());

        // ESC to close
        this.escHandler = (e) => {
            if (e.key === 'Escape') {
                this.dismissAndRefocus();
            }
        };
        document.addEventListener('keydown', this.escHandler);

        // Animate in
        setTimeout(() => this.popup.classList.add('socially-popup-visible'), 10);
    }

    accept() {
        const el = this.targetElement;
        const suggestionText = this.suggestionText || '';
        if (!el) {
            this.hide();
            return;
        }

        const tag = el.tagName && el.tagName.toLowerCase();
        if (tag === 'textarea' || tag === 'input') {
            el.value = suggestionText;
        } else if (el.isContentEditable) {
            el.textContent = suggestionText;
        }

        try {
            const event = new Event('input', { bubbles: true });
            el.dispatchEvent(event);
        } catch (_) { /* noop */ }

        const focusAfterHide = () => {
            try { this.focusEditableEnd(el); } catch (_) { }
        };

        this.hide();
        setTimeout(focusAfterHide, 320);
    }

    dismissAndRefocus() {
        // Clean up event listener
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }
        this.hide();
        // Restore focus after popup closes
        setTimeout(() => {
            if (this.targetElement) {
                try {
                    this.targetElement.focus();
                } catch (_) { }
            }
        }, 320);
    }

    hide() {
        // Clean up event listener
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }
        if (!this.popup) return;
        try { this.popup.style.pointerEvents = 'none'; } catch (_) { }
        this.popup.classList.remove('socially-popup-visible');
        const node = this.popup;
        this.popup = null;
        setTimeout(() => {
            if (node && node.parentNode) node.parentNode.removeChild(node);
        }, 300);
        setTimeout(() => {
            if (node && node.parentNode) {
                try { node.parentNode.removeChild(node); } catch (_) { }
            }
        }, 1500);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    focusEditableEnd(el) {
        if (!el) return;
        try { el.focus({ preventScroll: false }); } catch (_) { }
        const tag = el.tagName && el.tagName.toLowerCase();
        if (tag === 'textarea' || tag === 'input') {
            try {
                const len = el.value.length;
                el.setSelectionRange(len, len);
            } catch (_) { }
            return;
        }
        if (el.isContentEditable) {
            const selection = window.getSelection();
            if (!selection) return;
            const range = document.createRange();
            if (el.lastChild) {
                const node = el.lastChild;
                const length = (node.nodeType === Node.TEXT_NODE && node.nodeValue) ? node.nodeValue.length : (node.childNodes ? node.childNodes.length : 0);
                try { range.setStart(node, length); }
                catch (_) { range.selectNodeContents(el); range.collapse(false); }
            } else {
                range.selectNodeContents(el);
                range.collapse(false);
            }
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

// Singleton
export const confirmPopup = new ConfirmPopup();
