// results-popup.js

import { improvePopup } from './improve-popup.js';
import { getScoreColor } from './helpers.js';
import { improveSuggestion, analyzeText } from './api.js';
import { confirmPopup } from './confirm-popup.js';

// Creates and manages the analysis results popup

export class ResultsPopup {
    constructor() {
        this.popup = null;
        this.targetElement = null; // Store reference to the element being edited
        this.improvePopup = null; // Store reference to improve popup
        this.escHandler = null; // Store ESC handler for cleanup
        this.originalText = null; // Original user input text
    }


    /**
     * Create and show the popup with analysis results
     * @param {Object} results - Analysis results from backend
     * 
     * @param {string} results.old_toxicity - Toxicity score
     * @param {string} results.old_empathy - Empathy score
     * @param {string} results.old_politeness - Politeness score
     * @param {string} results.old_proSocial - Pro-social score
     * 
     * @param {string} results.new_toxicity - Toxicity score
     * @param {string} results.new_empathy - Empathy score
     * @param {string} results.new_politeness - Politeness score
     * @param {string} results.new_proSocial - Pro-social score
     * 
     * @param {string} results.suggestion - Rephrased suggestion
     * @param {HTMLElement} targetElement - The element to replace text in
     */
    show(results, targetElement = null) {
        this.targetElement = targetElement;
        this.lastResults = results;
        this.originalText = results && typeof results.original_text === 'string' ? results.original_text : null;

        // Clean up any existing popup (like loading screen) first
        this.forceClosePopup();
        this.cleanupAllPopups();

        // Create popup container
        this.popup = document.createElement('div');
        this.popup.className = 'socially-popup';
        // print results for debugging
        console.log('Showing results popup with data:', results);
        // Build popup content
        this.popup.innerHTML = `
            <div class="socially-popup-header">
                <h3>Analysis Results & Suggestion</h3>
                <button class="socially-close-btn" title="Close">&times;</button>
            </div>
            <div class="socially-popup-body">
                <!-- Scores Section -->
                <div class="socially-scores">
                    <h4>Scores <span class="score-legend">(Original Score → Improved Score)</span></h4>
                    <div class="score-item">
                        <span class="score-label">Toxicity:</span>
                        <span class="score-comparison">
                            <span class="${getScoreColor('toxicity', results.old_toxicity)}">${this.escapeHtml(results.old_toxicity)}</span>
                            <span class="score-arrow">→</span>
                            <span class="${getScoreColor('toxicity', results.new_toxicity)}">${this.escapeHtml(results.new_toxicity)}</span>
                        </span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">Empathy:</span>
                        <span class="score-comparison">
                            <span class="${getScoreColor('empathy', results.old_empathy)}">${this.escapeHtml(results.old_empathy)}</span>
                            <span class="score-arrow">→</span>
                            <span class="${getScoreColor('empathy', results.new_empathy)}">${this.escapeHtml(results.new_empathy)}</span>
                        </span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">Politeness:</span>
                        <span class="score-comparison">
                            <span class="${getScoreColor('politeness', results.old_politeness)}">${this.escapeHtml(results.old_politeness)}</span>
                            <span class="score-arrow">→</span>
                            <span class="${getScoreColor('politeness', results.new_politeness)}">${this.escapeHtml(results.new_politeness)}</span>
                        </span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">Pro-Social:</span>
                        <span class="score-comparison">
                            <span class="${getScoreColor('proSocial', results.old_proSocial)}">${this.escapeHtml(results.old_proSocial)}</span>
                            <span class="score-arrow">→</span>
                            <span class="${getScoreColor('proSocial', results.new_proSocial)}">${this.escapeHtml(results.new_proSocial)}</span>
                        </span>
                    </div>
                </div>
                <!-- Suggestion Section -->
                <div class="socially-suggestion">
                    <h4>Suggested Rephrase</h4>
                    <div class="suggestion-text">
                        ${this.escapeHtml(results.rephrased_text)}
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
        closeBtn.addEventListener('click', () => this.dismissAndRefocus());

        // Accept button
        const acceptBtn = this.popup.querySelector('.socially-accept-btn');
        acceptBtn.addEventListener('click', () => {
            this.acceptSuggestion(suggestionText);
        });

        // Dismiss button
        const dismissBtn = this.popup.querySelector('.socially-dismiss-btn');
        dismissBtn.addEventListener('click', () => {
            this.dismissAndRefocus();
        });



        // ESC key to close
        this.escHandler = (e) => {
            if (e.key === 'Escape') {
                this.dismissAndRefocus();
            }
        };
        document.addEventListener('keydown', this.escHandler);
    }

    /**
     * Dismiss popup and restore focus to the target element
     */
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
     * Analyze first to get initial scores, then show improve popup with those scores
     */
    async analyzeAndShowImprovePopup(text, targetElement) {
        this.originalText = text;
        this.targetElement = targetElement;

        this.showLoading();

        try {
            // Get initial analysis to have scores for the improve popup
            const initialResults = await analyzeText(text);
            console.log('Initial analysis results:', initialResults);

            // Store initial results
            this.initialResults = initialResults;

            // Hide loading and show improve popup WITH the initial scores
            this.forceClosePopup();

            const scores = {
                toxicity: initialResults?.old_toxicity || 'N/A',
                empathy: initialResults?.old_empathy || 'N/A',
                politeness: initialResults?.old_politeness || 'N/A',
                proSocial: initialResults?.old_proSocial || 'N/A'
            };

            improvePopup.show(
                { original_text: text, scores },
                async (data) => {
                    // User selected categories - show results with improvement
                    await this.showResultsWithImprovement(text, data.selectedCategories, targetElement);
                },
                () => {
                    // User cancelled - do nothing
                }
            );

        } catch (error) {
            console.error('Error analyzing text:', error);
            this.showError(`Failed to analyze text: ${error.message}`);
        }
    }

    /**
     * Show results (we already have initial analysis, just display it)
     */
    async showResultsWithImprovement(text, selectedCategories, targetElement) {
        // We already have the analysis results from initial analysis
        const improved = await improveSuggestion(text, selectedCategories);

        // Store original text and selected categories
        try { improved.original_text = text; } catch (_) { }
        try { improved.selectedCategories = selectedCategories; } catch (_) { }

        // Show results popup with reference to the element
        this.show(improved, targetElement);
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
    async submitImprovement(currentSuggestion, selectedCategories) {
        try {
            this.hideImprovePopup();
            // Call API without showing loading screen
            const improved = await improveSuggestion(currentSuggestion, selectedCategories);
            // Show confirm popup directly
            confirmPopup.show(improved, this.targetElement);
        } catch (e) {
            console.error('Improve failed', e);
            this.showError(`Improve failed: ${e.message || e}`);
        }
    }

    /**
     * Force immediate cleanup of any popup without animations
     */
    forceClosePopup() {
        if (this.popup && this.popup.parentNode) {
            try {
                this.popup.parentNode.removeChild(this.popup);
            } catch (_) { }
        }
        this.popup = null;
    }

    /**
     * Hide and remove the popup
     */
    hide() {
        // Clean up event listener
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }

        if (this.popup) {
            // Immediately stop intercepting clicks and start fade out
            try { this.popup.style.pointerEvents = 'none'; } catch (_) { }
            try { this.popup.classList.remove('socially-popup-visible'); } catch (_) { }

            const popupToRemove = this.popup;
            this.popup = null; // Clear reference immediately

            setTimeout(() => {
                if (popupToRemove && popupToRemove.parentNode) {
                    try {
                        popupToRemove.parentNode.removeChild(popupToRemove);
                    } catch (_) { }
                }
            }, 300); // Match CSS transition duration

            // Backup cleanup in case the first timer is interrupted
            setTimeout(() => {
                if (popupToRemove && popupToRemove.parentNode) {
                    try { popupToRemove.parentNode.removeChild(popupToRemove); } catch (_) { }
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
        // Force close any existing popup immediately
        this.forceClosePopup();
        // Also clean up any stray popups in the DOM
        this.cleanupAllPopups();

        this.popup = document.createElement('div');
        this.popup.className = 'socially-popup socially-loading-popup';
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
            if (this.popup) {
                this.popup.classList.add('socially-popup-visible');
            }
        }, 10);
    }

    /**
     * Clean up any stray popups that might be left in the DOM
     */
    cleanupAllPopups() {
        const popups = document.querySelectorAll('.socially-popup');
        popups.forEach(popup => {
            try {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
            } catch (_) { }
        });
    }

    /**
     * Show error message
     */
    showError(errorMessage) {
        // Force close any existing popup immediately
        this.forceClosePopup();
        this.cleanupAllPopups();

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
