// main.js

import { initMutationObserver } from './mutation-observer.js';
import { autoAttachBestMatch } from './editor-attachment.js';
import './test-popup.js'; // Import test functions for easy testing

// Content-capture helper: attach to textareas, inputs and contenteditable elements
// Emits a custom event 'socially-like-input' on the element when debounced input is ready.
// Event detail: { text, selectionStart, selectionEnd, surroundingText, isComposing, element }
(() => {

    // Initialize the Mutation Observer to watch for dynamic additions of editable elements
    const mo = initMutationObserver();

    // Initial scan to attach to existing editable elements on page load
    setTimeout(() => {
        autoAttachBestMatch(document);
    }, 50);

    // Expose a global helper for manual attachment
    window.__sociallyCapture = {
        attach: (el) => attachToEditable(el), // Assumes attachToEditable is imported or available in scope
        scan: (n) => autoAttachBestMatch(n),
        disconnectObserver: () => mo.disconnect(),
    };

    // Log to indicate that the script is active
    console.log('socially-capture: script injected and active');

})();
