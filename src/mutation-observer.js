// mutation-observer.js

import { autoAttachBestMatch } from './editor-attachment.js';

// Initialize Mutation Observer
export function initMutationObserver() {
    const mo = new MutationObserver(muts => {
        for (const m of muts) {
            if (m.addedNodes && m.addedNodes.length) {
                autoAttachBestMatch(document);
            }
        }
    });

    mo.observe(document.documentElement || document, { childList: true, subtree: true });

    return mo;
}