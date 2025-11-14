// improve-popup.js

import { getScoreColor } from './helpers.js';

// Handles the Improve Suggestion popup

export class ImprovePopup {
    constructor() {
        this.popup = null;
    }


    /**
     * Show the improve popup with checklist for categories
     * @param {Object} suggestionData - { original_text, scores }
     * @param {Function} onSubmit - callback(selectedCategories)
     * @param {Function} onCancel - callback()
     */
    show(suggestionData, onSubmit, onCancel) {
        // suggestionData: { original_text, scores: { toxicity, empathy, thoughtfulness, proSocial } }
        const { original_text, scores } = suggestionData;
        this.popup = document.createElement('div');
        this.popup.className = 'socially-popup socially-improve-popup';
        this.popup.innerHTML = `
            <div class="socially-popup-header">
                <h3>Improve Suggestion</h3>
                <button class="socially-close-improve-btn" title="Close">&times;</button>
            </div>
            <div class="socially-popup-body">
                <p>Current suggestion:</p>
                <div class="improve-current-text">
                    ${this.escapeHtml(original_text)}
                </div>
                <div class="improve-input-section">
                    <label>Select categories to improve:</label>
                    <div class="improve-checklist">
                        <label><input type="checkbox" class="improve-checkbox" value="toxicity"> Toxicity <span class="score-badge ${getScoreColor('toxicity', scores.toxicity)}">${this.escapeHtml(scores.toxicity)}</span></label><br>
                        <label><input type="checkbox" class="improve-checkbox" value="empathy"> Empathy <span class="score-badge ${getScoreColor('empathy', scores.empathy)}">${this.escapeHtml(scores.empathy)}</span></label><br>
                        <label><input type="checkbox" class="improve-checkbox" value="politeness"> Politeness <span class="score-badge ${getScoreColor('politeness', scores.politeness)}">${this.escapeHtml(scores.politeness)}</span></label><br>
                        <label><input type="checkbox" class="improve-checkbox" value="proSocial"> Pro-Social <span class="score-badge ${getScoreColor('proSocial', scores.proSocial)}">${this.escapeHtml(scores.proSocial)}</span></label>
                    </div>
                </div>
                <div class="improve-actions">
                    <button class="socially-improve-submit-btn">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Generate Improvement
                    </button>
                    <button class="socially-improve-cancel-btn">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.popup);

        setTimeout(() => {
            this.popup.classList.add('socially-popup-visible');
        }, 10);

        // Event listeners
        const closeBtn = this.popup.querySelector('.socially-close-improve-btn');
        closeBtn.addEventListener('click', () => this.hide(onCancel));

        const cancelBtn = this.popup.querySelector('.socially-improve-cancel-btn');
        cancelBtn.addEventListener('click', () => this.hide(onCancel));

        const submitBtn = this.popup.querySelector('.socially-improve-submit-btn');
        submitBtn.addEventListener('click', () => {
            // Gather selected categories
            const checked = Array.from(this.popup.querySelectorAll('.improve-checkbox:checked')).map(cb => cb.value);
            if (onSubmit) onSubmit({
                original_text,
                selectedCategories: checked,
                scores
            });
            this.hide();
        });
    }

    hide(callback) {
        if (this.popup) {
            this.popup.classList.remove('socially-popup-visible');
            setTimeout(() => {
                if (this.popup && this.popup.parentNode) {
                    this.popup.parentNode.removeChild(this.popup);
                }
                this.popup = null;
                if (callback) callback();
            }, 300);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export const improvePopup = new ImprovePopup();
