// Content-capture helper: attach to textareas, inputs and contenteditable elements
// Emits a custom event 'grammarly-like-input' on the element when debounced input is ready.
// Event detail: { text, selectionStart, selectionEnd, surroundingText, isComposing, element }
(() => {
    const DEFAULT_DEBOUNCE_MS = 500;

    // Check if a node is an editable element
    function isEditable(node) {
        if (!node) return false;
        if (node.nodeType !== 1) return false;
        const tag = node.tagName && node.tagName.toLowerCase();
        if (tag === 'textarea' || (tag === 'input' && (node.type === 'text' || node.type === 'search'))) return true;
        if (node.isContentEditable) return true;
        return false;
    }

    // Get text content of an editable element
    function getText(node) {
        if (!node) return '';
        const tag = node.tagName && node.tagName.toLowerCase();
        if (tag === 'textarea' || tag === 'input') return node.value;
        // For contenteditable, prefer innerText to avoid markup
        return node.innerText || node.textContent || '';
    }

    // Compute caret offset for contenteditable elements
    function getCaretCharacterOffsetWithin(element) {
        let caretOffset = 0;
        const doc = element.ownerDocument || document;
        const win = doc.defaultView || window;
        const sel = win.getSelection();
        if (!sel || sel.rangeCount === 0) return 0;
        const range = sel.getRangeAt(0);
        const preRange = range.cloneRange();
        preRange.selectNodeContents(element);
        preRange.setEnd(range.endContainer, range.endOffset);
        const temp = preRange.toString();
        caretOffset = temp.length;
        return caretOffset;
    }

    function getSelectionOffsets(node) {
        const tag = node.tagName && node.tagName.toLowerCase();
        if (tag === 'textarea' || tag === 'input') {
            return { start: node.selectionStart, end: node.selectionEnd };
        }
        // contenteditable
        const doc = node.ownerDocument || document;
        const win = doc.defaultView || window;
        const sel = win.getSelection();
        if (!sel || sel.rangeCount === 0) return { start: 0, end: 0 };
        const range = sel.getRangeAt(0);
        // Only compute offsets when selection is within the node
        let start = 0, end = 0;
        try {
            const preRange = range.cloneRange();
            preRange.selectNodeContents(node);
            preRange.setEnd(range.startContainer, range.startOffset);
            start = preRange.toString().length;
            const preRange2 = range.cloneRange();
            preRange2.selectNodeContents(node);
            preRange2.setEnd(range.endContainer, range.endOffset);
            end = preRange2.toString().length;
        } catch (e) {
            // fallback
            start = end = getCaretCharacterOffsetWithin(node);
        }
        return { start, end };
    }

    // Get surrounding text around selection for context
    function surroundingTextForOffsets(text, start, end, radius = 40) {
        const s = Math.max(0, start - radius);
        const e = Math.min(text.length, end + radius);
        return text.substring(s, e);
    }

    // Attach to an editable element to listen for input events
    function attachToEditable(el, options = {}) {
        if (!isEditable(el)) return null;
        if (el.__grammarlyCaptureAttached) return el.__grammarlyCaptureAttached;

        const debounceMs = options.debounceMs || DEFAULT_DEBOUNCE_MS;
        let timer = null;
        let isComposing = false;

        // Emit the custom event with current text and selection info
        function emit(now = false) {
            if (isComposing && !now) return; // don't emit while IME composing
            clearTimeout(timer);
            const text = getText(el);
            const sel = getSelectionOffsets(el);
            const surrounding = surroundingTextForOffsets(text, sel.start, sel.end);
            const detail = {
                text,
                selectionStart: sel.start,
                selectionEnd: sel.end,
                surroundingText: surrounding,
                isComposing,
                element: el,
            };
            // mark our events so they can be distinguished from page events
            try { detail.__grammarly = true; } catch (e) {}
            const ev = new CustomEvent('grammarly-like-input', { detail });
            try { el.dispatchEvent(ev); } catch (e) {}
            // also dispatch on document to ensure consumers listening at document/window capture it
            try { document.dispatchEvent(new CustomEvent('grammarly-like-input', { detail })); } catch (e) {}
            // Expose the last detail on window and post a message to the page so page scripts can reliably receive structured data
            try { window.__grammarly_last = detail; } catch (e) {}
            try { window.postMessage && window.postMessage({ source: 'grammarly-capture', type: 'grammarly-like-input', detail }, '*'); } catch (e) {}

            // Debug: always log emit payload to page console so you can see it regardless of log level
            try { console.log('grammarly-capture: emit', detail); } catch (e) {}

            // Robust fallback: write the payload into a temporary <script type="application/json"> element
            // and dispatch a small event containing the element id. Page scripts can read the JSON from the node.
            try {
                const payloadId = '__grammarly_payload_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                const scriptNode = document.createElement('script');
                scriptNode.type = 'application/json';
                scriptNode.id = payloadId;
                // store as textContent so page can read it synchronously
                scriptNode.textContent = JSON.stringify(detail);
                // append to documentElement so it's accessible from any frame same-origin
                (document.documentElement || document.body || document).appendChild(scriptNode);
                // dispatch a lightweight event with only the payloadId
                try { document.dispatchEvent(new CustomEvent('grammarly-like-input-payload', { detail: { payloadId } })); } catch (e) {}
                // schedule cleanup
                setTimeout(() => {
                    try { const n = document.getElementById(payloadId); if (n) n.remove(); } catch (e) {}
                }, 5000);
            } catch (e) {
                // best-effort only
            }
        }

        // Schedule an emit after debounce
        function scheduleEmit() {
            clearTimeout(timer);
            timer = setTimeout(() => emit(true), debounceMs);
        }

        // Event handlers
        function onInput(e) {
            // input events fire during composition in some browsers; don't send until compositionend
            scheduleEmit();
        }

        // Keyup can help detect sentence-ending punctuation
        function onKeyup(e) {
            // Emit sooner on sentence end or specific keys
            const val = getText(el);
            const pos = (getSelectionOffsets(el).end) || val.length;
            const ch = val[pos - 1];
            if (ch === '.' || ch === '?' || ch === '!' || ch === '\n') {
                emit(true);
            }
        }

        // Composition events for IME input
        function onCompositionStart() {
            isComposing = true;
        }

        // Composition end
        function onCompositionEnd() {
            isComposing = false;
            // After composition ends, emit immediately
            emit(true);
        }

        // Attach events depending on element type
        const tag = el.tagName && el.tagName.toLowerCase();
        if (tag === 'textarea' || tag === 'input') {
            el.addEventListener('input', onInput);
            el.addEventListener('keyup', onKeyup);
            el.addEventListener('compositionstart', onCompositionStart);
            el.addEventListener('compositionend', onCompositionEnd);
        } else if (el.isContentEditable) {
            el.addEventListener('input', onInput);
            // keyup helps detect punctuation typed
            el.addEventListener('keyup', onKeyup);
            el.addEventListener('compositionstart', onCompositionStart);
            el.addEventListener('compositionend', onCompositionEnd);
            // selection changes can affect caret position
            el.addEventListener('mouseup', () => scheduleEmit());
            el.addEventListener('focus', () => scheduleEmit());
        }

        // store cleanup/reference
        const attached = {
            element: el,
            detach() {
                try {
                    if (tag === 'textarea' || tag === 'input') {
                        el.removeEventListener('input', onInput);
                        el.removeEventListener('keyup', onKeyup);
                        el.removeEventListener('compositionstart', onCompositionStart);
                        el.removeEventListener('compositionend', onCompositionEnd);
                    } else if (el.isContentEditable) {
                        el.removeEventListener('input', onInput);
                        el.removeEventListener('keyup', onKeyup);
                        el.removeEventListener('compositionstart', onCompositionStart);
                        el.removeEventListener('compositionend', onCompositionEnd);
                        el.removeEventListener('mouseup', scheduleEmit);
                        el.removeEventListener('focus', scheduleEmit);
                    }
                } catch (e) {
                    // ignore
                }
                clearTimeout(timer);
                el.__grammarlyCaptureAttached = null;
            }
        };

        el.__grammarlyCaptureAttached = attached;
        return attached;
    }

    function scanAndAttach(root = document) {
        // Broaden selector to catch editors that don't use contenteditable=true
        const selector = [
            'textarea',
            'input[type="text"]',
            'input[type="search"]',
            'input[type="email"]',
            '[contenteditable]',
            '[role="textbox"]',
            '[aria-multiline="true"]',
            'div[role="textbox"]'
        ].join(',');
        const nodes = root.querySelectorAll(selector);
        nodes.forEach(n => attachToEditable(n));

        // Also traverse shadow roots to find hidden editors
        const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
        while (treeWalker.nextNode()) {
            const node = treeWalker.currentNode;
            if (node.shadowRoot) {
                try {
                    const sroot = node.shadowRoot;
                    const snodes = sroot.querySelectorAll(selector);
                    snodes.forEach(n => attachToEditable(n));
                } catch (e) {
                    // ignore cross-origin or inaccessible shadow roots
                }
            }
        }
    }

    // Deep-scan same-origin frames: run scanAndAttach on each accessible frame.document
    function deepScan() {
        try {
            scanAndAttach(document);
            Array.from(window.frames).forEach((f, idx) => {
                try {
                    if (f && f.document) {
                        // only same-origin frames will expose document
                        console.debug('grammarly-capture: deepScan scanning frame', idx, f.location && f.location.href);
                        scanAndAttach(f.document);
                    }
                } catch (e) {
                    // cross-origin frames will throw
                    console.debug('grammarly-capture: deepScan cannot access frame', idx);
                }
            });
        } catch (e) {
            console.error('grammarly-capture: deepScan error', e);
        }
    }

    // Try to find a best-match editor (Outlook, Gmail, etc.) and attach automatically
    function autoAttachBestMatch() {
        try {
            // Prioritized selectors for common rich editors
            const priority = [
                'div[role="textbox"][aria-label*="Message body"]',
                '.EditorClass[contenteditable="true"]',
                'div[role="textbox"][aria-multiline="true"]',
                '[aria-label*="Message body"][contenteditable="true"]',
                '[contenteditable="true"]'
            ];
            for (const sel of priority) {
                const el = document.querySelector(sel);
                if (el) {
                    const attached = attachToEditable(el);
                    // Always ensure an attribute mark exists for visibility
                    try { el.setAttribute('data-grammarly-attached', 'true'); } catch (e) {}
                    // If attach didn't produce the attached object (framework replaced the node), add backup listeners
                    if (!attached) {
                        setupBackupListeners(el);
                        console.log('grammarly-capture: auto-attached (backup) to element', sel, el);
                        return { backup: true };
                    }
                    console.log('grammarly-capture: auto-attached to element', sel, el);
                    return attached;
                }
            }
            // fallback: scan for any contenteditable with reasonable size
            const cands = [...document.querySelectorAll('[contenteditable]')].filter(n => (n.innerText || '').length < 100000);
            for (const el of cands) {
                const attached = attachToEditable(el);
                try { el.setAttribute('data-grammarly-attached', 'true'); } catch (e) {}
                if (!attached) {
                    setupBackupListeners(el);
                    console.log('grammarly-capture: auto-attached fallback (backup)', el);
                    return { backup: true };
                }
                console.log('grammarly-capture: auto-attached fallback', el);
                return attached;
            }
        } catch (e) {
            console.error('grammarly-capture: autoAttachBestMatch error', e);
        }
        return null;
    }

    // Backup listeners map to allow cleanup if node is replaced
    const __backupListeners = new WeakMap();

    function emitForElement(el) {
        try {
            const text = getText(el);
            const sel = getSelectionOffsets(el);
            const surrounding = surroundingTextForOffsets(text, sel.start, sel.end);
            const detail = {
                text,
                selectionStart: sel.start,
                selectionEnd: sel.end,
                surroundingText: surrounding,
                isComposing: false,
                element: el,
            };
            // reuse same dispatch/fallback logic as emit()
            try { detail.__grammarly = true; } catch (e) {}
            try { el.dispatchEvent(new CustomEvent('grammarly-like-input', { detail })); } catch (e) {}
            try { document.dispatchEvent(new CustomEvent('grammarly-like-input', { detail })); } catch (e) {}
            try { window.__grammarly_last = detail; } catch (e) {}
            try { window.postMessage && window.postMessage({ source: 'grammarly-capture', type: 'grammarly-like-input', detail }, '*'); } catch (e) {}
            try { console.log('grammarly-capture: emit (backup)', detail); } catch (e) {}
            try {
                const payloadId = '__grammarly_payload_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                const scriptNode = document.createElement('script');
                scriptNode.type = 'application/json';
                scriptNode.id = payloadId;
                scriptNode.textContent = JSON.stringify(detail);
                (document.documentElement || document.body || document).appendChild(scriptNode);
                try { document.dispatchEvent(new CustomEvent('grammarly-like-input-payload', { detail: { payloadId } })); } catch (e) {}
                setTimeout(() => { try { const n = document.getElementById(payloadId); if (n) n.remove(); } catch (e) {} }, 5000);
            } catch (e) {}
        } catch (e) {
            // ignore
        }
    }

    function setupBackupListeners(el) {
        if (!el || __backupListeners.has(el)) return;
        const onInput = () => emitForElement(el);
        const onKeyup = (e) => {
            const val = getText(el);
            const pos = (getSelectionOffsets(el).end) || val.length;
            const ch = val[pos - 1];
            if (ch === '.' || ch === '?' || ch === '!' || ch === '\n') emitForElement(el);
        };
        const onCompositionEnd = () => emitForElement(el);
        el.addEventListener('input', onInput);
        el.addEventListener('keyup', onKeyup);
        el.addEventListener('compositionend', onCompositionEnd);
        __backupListeners.set(el, { onInput, onKeyup, onCompositionEnd });
    }

    // Watch for dynamically added editable elements
    const mo = new MutationObserver(muts => {
        for (const m of muts) {
            if (m.addedNodes && m.addedNodes.length) {
                m.addedNodes.forEach(n => {
                    if (n.nodeType !== 1) return;
                    if (isEditable(n)) attachToEditable(n);
                    // also scan descendants
                    scanAndAttach(n);
                });
            }
        }
    });
    mo.observe(document.documentElement || document, { childList: true, subtree: true });

    // Auto-attach when elements receive focus (helps editors created on demand)
    document.addEventListener('focusin', (e) => {
        try {
            const t = e.target;
            if (!t) return;
            if (isEditable(t) || (t.querySelector && t.querySelector('[contenteditable]'))) {
                attachToEditable(t);
            }
        } catch (err) {}
    }, true);

    // Expose a global helper for manual attachment
    window.__grammarlyCapture = {
        attach: attachToEditable,
        scan: scanAndAttach,
        disconnectObserver() { mo.disconnect(); }
    };

    // Initial scan
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { scanAndAttach(); deepScan(); });
    } else {
        scanAndAttach();
        // also attempt deep scan of same-origin frames
        setTimeout(() => {
            deepScan();
            // after deep scan, try to auto-attach to a best-match editor in this frame
            autoAttachBestMatch();
        }, 50);
    }

    // Convenience: log events globally for debugging; in production you'd send to backend.
    // Register the listener immediately so that when the script is injected after page load
    // (common for runtime/activeTab injection) we still receive events.
    document.addEventListener('grammarly-like-input', (ev) => {
        // ev.detail contains text, selectionStart, selectionEnd, surroundingText, isComposing, element
        // Example: debounce-safe place to call your analysis endpoint
        // fetch('/api/analyze', { method: 'POST', body: JSON.stringify(ev.detail) })...
        console.debug('grammarly-like-input', ev.detail);
    }, true);

    // Indicate the content script is active (helps debug injection timing)
    console.log('grammarly-capture: script injected and active');
})();
