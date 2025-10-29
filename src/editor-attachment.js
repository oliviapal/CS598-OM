// editor-attachment.js

import { isEditable, getText, DEFAULT_DEBOUNCE_MS } from './utils.js';
import { getPrioritySelectors } from './selectors.js';
import { resultsPopup } from './results-popup.js';
import { showTestPopup } from './test-popup.js';
import { analyzeText } from './api.js';

// Attach to an editable element to listen for input events
export function attachToEditable(el, options = {}) {
    if (!isEditable(el)) return null;
    if (el.__sociallyCaptureAttached) return el.__sociallyCaptureAttached;

    const debounceMs = options.debounceMs || DEFAULT_DEBOUNCE_MS;
    let timer = null;
    let isComposing = false;

    // Create the "S" icon button dynamically
    const iconButton = document.createElement('button');
    iconButton.innerText = 'S';
    iconButton.style.backgroundColor = '#4CAF50'; // Green
    iconButton.style.color = 'white'; // White text
    iconButton.style.border = 'none';
    iconButton.style.borderRadius = '5px';
    iconButton.style.cursor = 'pointer';
    iconButton.style.padding = '5px';
    iconButton.style.position = 'relative'; // Absolute positioning
    iconButton.style.width = '24px';
    iconButton.style.zIndex = '9000';
    iconButton.style.opacity = '1.0';
    iconButton.style.display = 'inline-flex';
    iconButton.style.visibility = 'visible';

    // Handle icon button click
    iconButton.addEventListener('click', async () => {
        const text = getText(el);
        console.log('Text to analyze:', text);

        if (!text || text.trim().length === 0) {
            resultsPopup.showError('Please enter some text to analyze.');
            return;
        }

        //showTestPopup();

        // Show loading state
        resultsPopup.showLoading();

        try {
            // Call backend API to analyze the text
            const results = await analyzeText(text);
            console.log('Analysis results:', results);

            // Show results popup with reference to the element
            resultsPopup.show(results, el);

        } catch (error) {
            console.error('Error analyzing text:', error);
            resultsPopup.showError(`Failed to analyze text: ${error.message}`);
        }


    });

    // Add icon to the DOM
    el.after(iconButton); // Append the icon to the body or the desired parent

    // Store cleanup/reference
    const attached = {
        element: el,
        detach() {
            el.__sociallyCaptureAttached = null;
        }
    };

    el.__sociallyCaptureAttached = attached;
    return attached;
}


// Try to find a best-match editor (Outlook, Gmail, etc.) and attach automatically
export function autoAttachBestMatch(n) {
    // Prioritized selectors for common rich editors
    const currentUrl = window.location.href; // Get the current URL
    const priority = getPrioritySelectors(currentUrl);  // Call the function to get selectors

    for (const sel of priority) {
        const el = findFirstInShadowRoots(sel, n)
        if (el) {
            let attached_bool = el.getAttribute('data-socially-attached');
            if (attached_bool == null || attached_bool === 'false') {
                const attached = attachToEditable(el);
                // Always ensure an attribute mark exists for visibility
                try { el.setAttribute('data-socially-attached', 'true'); } catch (e) { }
                console.log('socially-capture: auto-attached to element', sel, el);
                return attached;
            }
        }
    }
    // Else, return none
    return null;
}


function findFirstInShadowRoots(selector, root = document) {
    // Check for the matching element on the current level
    const matchingElement = root.querySelector(selector);
    if (matchingElement) {
        return matchingElement; // Return if found
    }

    // Iterate through all child elements
    const childElements = root.children;
    for (let element of childElements) {
        // Check for shadow root and recursively call the function if it exists
        if (element.shadowRoot) {
            const foundInShadow = findFirstInShadowRoots(selector, element.shadowRoot);
            if (foundInShadow) {
                return foundInShadow; // Return if found in shadow root
            }
        }
        // Recursively check in the child elements' shadow roots
        const foundInChildren = findFirstInShadowRoots(selector, element);
        if (foundInChildren) {
            return foundInChildren; // Return if found in children
        }
    }

    return null; // Return null if no match is found
}