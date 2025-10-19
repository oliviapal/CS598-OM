// utils.js

// Default debounce time
export const DEFAULT_DEBOUNCE_MS = 500;


// Check if a node is an editable element
export function isEditable(node) {
    if (!node) return false;
    if (node.nodeType !== 1) return false;
    const tag = node.tagName && node.tagName.toLowerCase();
    if (tag === 'textarea' || (tag === 'input' && (node.type === 'text' || node.type === 'search'))) return true;
    if (node.isContentEditable) return true;
    return false;
}


// Get text content of an editable element
export function getText(node) {
    if (!node) return '';
    const tag = node.tagName && node.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'input') return node.value;
    // For contenteditable, prefer innerText to avoid markup
    return node.innerText || node.textContent || '';
}