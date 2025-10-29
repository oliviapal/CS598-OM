// test-popup.js
// Demo/test file to show the popup with sample data

import { resultsPopup } from './results-popup.js';

/**
 * Show a test popup with sample data
 */
export function showTestPopup() {
    const sampleResults = {
        toxicity: "0.23 (Low)",
        empathy: "0.87 (High)",
        thoughtfulness: "0.75 (Good)",
        proSocial: "0.91 (Excellent)",
        suggestion: "I really appreciate your perspective on this matter. It would be great if we could discuss this further and find a solution that works for everyone."
    };

    // Try to find an editable element for testing, or pass null
    const editableElement = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');

    resultsPopup.show(sampleResults, editableElement);
}

/**
 * Show a loading popup for testing
 */
export function showTestLoading() {
    resultsPopup.showLoading();

    // Simulate API call - show results after 2 seconds
    setTimeout(() => {
        showTestPopup();
    }, 2000);
}

/**
 * Show an error popup for testing
 */
export function showTestError() {
    resultsPopup.showError('This is a test error message. The backend server might be unavailable.');
}

// Expose test functions globally for easy testing in console
if (typeof window !== 'undefined') {
    window.__testPopup = {
        show: showTestPopup,
        loading: showTestLoading,
        error: showTestError
    };
    console.log('Test popup functions available: window.__testPopup.show(), window.__testPopup.loading(), window.__testPopup.error()');
}
