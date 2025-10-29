// results-popup.js

import { improvePopup } from './improve-popup.js';
import { getScoreColor } from './helpers.js';

// Creates and manages the analysis results popup

export class ResultsPopup {
    constructor() {
        this.popup = null;
        this.targetElement = null; // Store reference to the element being edited
        this.improvePopup = null; // Store reference to improve popup
    }


    /**
     * Create and show the popup with analysis results
     * @param {Object} results - Analysis results from backend
     * @param {string} results.toxicity - Toxicity score
     * @param {string} results.empathy - Empathy score
     * @param {string} results.thoughtfulness - Thoughtfulness score
     * @param {string} results.proSocial - Pro-social score
     * @param {string} results.suggestion - Rephrased suggestion
     * @param {HTMLElement} targetElement - The element to replace text in
     */
    show(results, targetElement = null) {
        this.targetElement = targetElement;
        this.lastResults = results;

        // Create popup container
        this.popup = document.createElement('div');
        this.popup.className = 'socially-popup';

        // Build popup content
        this.popup.innerHTML = `
            <div class="socially-popup-header">
                <h3>Analysis Results</h3>
                <button class="socially-close-btn" title="Close">&times;</button>
            </div>
            <div class="socially-popup-body">
                <!-- Scores Section -->
                <div class="socially-scores">
                    <h4>Scores</h4>
                    <div class="score-item">
                        <span class="score-label">Toxicity:</span>
                        <span class="${getScoreColor('toxicity', results.toxicity)}">${this.escapeHtml(results.toxicity)}</span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">Empathy:</span>
                        <span class="${getScoreColor('empathy', results.empathy)}">${this.escapeHtml(results.empathy)}</span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">Thoughtfulness:</span>
                        <span class="${getScoreColor('thoughtfulness', results.thoughtfulness)}">${this.escapeHtml(results.thoughtfulness)}</span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">Pro-Social:</span>
                        <span class="${getScoreColor('proSocial', results.proSocial)}">${this.escapeHtml(results.proSocial)}</span>
                    </div>
                </div>
                <!-- Suggestion Section -->
                <div class="socially-suggestion">
                    <h4>Suggested Rephrase</h4>
                    <div class="suggestion-text">
                        ${this.escapeHtml(results.suggestion)}
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
                        <button class="socially-improve-btn" title="Improve further">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                            </svg>
                            Improve
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Append to body
        document.body.appendChild(this.popup);

        // Add event listeners
        this.attachEventListeners(results.suggestion);

        // Add animation class
        setTimeout(() => {
            this.popup.classList.add('socially-popup-visible');
        }, 10);
    }

    /**
     * Attach event listeners to popup elements
     */
    attachEventListeners(suggestionText) {
        // Close button
        const closeBtn = this.popup.querySelector('.socially-close-btn');
        closeBtn.addEventListener('click', () => this.hide());

        // Accept button
        const acceptBtn = this.popup.querySelector('.socially-accept-btn');
        acceptBtn.addEventListener('click', () => {
            this.acceptSuggestion(suggestionText);
        });

        // Dismiss button
        const dismissBtn = this.popup.querySelector('.socially-dismiss-btn');
        dismissBtn.addEventListener('click', () => {
            this.hide();
        });

        // Improve button
        const improveBtn = this.popup.querySelector('.socially-improve-btn');
        improveBtn.addEventListener('click', () => {
            this.showImprovePopup(suggestionText);
        });

        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * Accept the suggestion and replace text in the target element
     */
    acceptSuggestion(suggestionText) {
        const el = this.targetElement;
        if (el) {
            const tag = el.tagName && el.tagName.toLowerCase();
            if (tag === 'textarea' || tag === 'input') {
                el.value = suggestionText;
            } else if (el.isContentEditable) {
                // Prefer textContent to avoid HTML injection; preserves contenteditable
                el.textContent = suggestionText;
            }

            // Trigger input event so other listeners are notified (e.g., React controlled inputs)
            const event = new Event('input', { bubbles: true });
            el.dispatchEvent(event);

            // After closing the popup, return focus and place caret at end
            const focusAfterHide = () => {
                try {
                    this.focusEditableEnd(el);
                } catch (_) { /* noop */ }
            };

            // Close the popup first so it doesn't intercept clicks, then refocus
            this.hide();
            setTimeout(focusAfterHide, 320); // slightly more than hide() transition

            console.log('Suggestion accepted and text replaced');
        } else {
            console.warn('No target element to replace text in');
            this.hide();
        }
    }

    /**
     * Show the improve popup
     */
    showImprovePopup(currentSuggestion) {
        // Pass suggestion and scores to improvePopup
        const scores = {
            toxicity: this.lastResults?.toxicity || '',
            empathy: this.lastResults?.empathy || '',
            thoughtfulness: this.lastResults?.thoughtfulness || '',
            proSocial: this.lastResults?.proSocial || ''
        };
        improvePopup.show(
            { suggestion: currentSuggestion, scores },
            (data) => this.submitImprovement(data.suggestion, data.selectedCategories, data.scores),
            () => { }
        );
    }

    /**
     * Hide the improve popup
     */
    hideImprovePopup() {
        improvePopup.hide();
    }

    /**
     * Submit improvement request
     */
    submitImprovement(currentSuggestion, selectedCategories, scores) {
        console.log('Improve request:', { currentSuggestion, selectedCategories, scores });
        // TODO: Call backend API to improve the suggestion
        // For now, just show a placeholder message
        alert(`Improvement requested!\nCurrent: ${currentSuggestion}\nCategories to improve: ${selectedCategories.join(', ')}\nScores: ${JSON.stringify(scores)}`);
        this.hideImprovePopup();
    }

    /**
     * Hide and remove the popup
     */
    hide() {
        if (this.popup) {
            // Immediately stop intercepting clicks
            try { this.popup.style.pointerEvents = 'none'; } catch (_) { }
            this.popup.classList.remove('socially-popup-visible');

            setTimeout(() => {
                if (this.popup && this.popup.parentNode) {
                    this.popup.parentNode.removeChild(this.popup);
                }
                this.popup = null;
                // Do NOT clear targetElement here to allow focus restoration right after hide
            }, 300); // Match CSS transition duration

            // Backup cleanup in case the first timer is interrupted
            setTimeout(() => {
                if (this.popup && this.popup.parentNode) {
                    try { this.popup.parentNode.removeChild(this.popup); } catch (_) { }
                    this.popup = null;
                }
            }, 1500);
        }

        // Also hide improve popup if it exists
        this.hideImprovePopup();
    }

    /**
     * Focus the editable element and move the caret to the end
     */
    focusEditableEnd(el) {
        if (!el) return;
        // Focus element
        el.focus({ preventScroll: false });

        const tag = el.tagName && el.tagName.toLowerCase();
        if (tag === 'textarea' || tag === 'input') {
            const len = el.value.length;
            try {
                el.setSelectionRange(len, len);
            } catch (_) { /* some inputs may not support selection */ }
            return;
        }

        if (el.isContentEditable) {
            const selection = window.getSelection();
            if (!selection) return;
            const range = document.createRange();
            // Place caret at the end of the contenteditable
            if (el.lastChild) {
                const node = el.lastChild;
                const length = (node.nodeType === Node.TEXT_NODE && node.nodeValue) ? node.nodeValue.length : (node.childNodes ? node.childNodes.length : 0);
                try {
                    range.setStart(node, length);
                } catch (_) {
                    range.selectNodeContents(el);
                    range.collapse(false);
                }
            } else {
                range.selectNodeContents(el);
                range.collapse(false);
            }
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.hide();

        this.popup = document.createElement('div');
        this.popup.className = 'socially-popup';
        this.popup.innerHTML = `
            <div class="socially-popup-header">
                <h3>Analyzing...</h3>
            </div>
            <div class="socially-popup-body">
                <div class="socially-loading">
                    <div class="spinner"></div>
                    <p>Please wait while we analyze your text...</p>
                </div>
            </div>
        `;

        document.body.appendChild(this.popup);

        setTimeout(() => {
            this.popup.classList.add('socially-popup-visible');
        }, 10);
    }

    /**
     * Show error message
     */
    showError(errorMessage) {
        this.hide();

        this.popup = document.createElement('div');
        this.popup.className = 'socially-popup';
        this.popup.innerHTML = `
            <div class="socially-popup-header">
                <h3>Error</h3>
                <button class="socially-close-btn" title="Close">&times;</button>
            </div>
            <div class="socially-popup-body">
                <div class="socially-error">
                    <p>${this.escapeHtml(errorMessage)}</p>
                </div>
            </div>
        `;

        document.body.appendChild(this.popup);

        const closeBtn = this.popup.querySelector('.socially-close-btn');
        closeBtn.addEventListener('click', () => this.hide());
        setTimeout(() => {
            this.popup.classList.add('socially-popup-visible');
        }, 10);
    }
}

// Create a singleton instance
export const resultsPopup = new ResultsPopup();
