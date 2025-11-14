// api.js
// Backend API communication for FastAPI backend in ./backend

// Default to FastAPI's typical local URL; can be changed at runtime via setBackendURL
let BACKEND_URL = 'http://127.0.0.1:8000';

async function request(path, options = {}) {
    const url = `${BACKEND_URL}${path}`;
    const resp = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!resp.ok) {
        let details = '';
        try { details = JSON.stringify(await resp.json()); } catch { }
        throw new Error(`HTTP ${resp.status} ${resp.statusText}${details ? ': ' + details : ''}`);
    }
    try { return await resp.json(); } catch { return null; }
}

/**
 * Analyze text using the backend API
 * @param {string} text - The text to analyze
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeText(text) {
    // We map response into the UI shape expected by the results popup.
    const payload = {
        user_input: text
    };
    const data = await request('/analyze', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    // get the verdict result
    const verdict = data?.verdict || null;
    const rephrase_data = await request('/rephrase', {
        method: 'POST',
        body: JSON.stringify({
            user_input: text,
            input_label: verdict?.label || 'N/A',
            // the verdict.reasons is also a dictionary, we convert it to string for rephrase_note
            rephrase_reasons: JSON.stringify(verdict?.reasons || {}),
        }),
    });

    return {
        old_toxicity: data?.old_toxicity || 'N/A',
        old_empathy: data?.old_sentiment || 'N/A',
        old_thoughtfulness: data?.old_thoughtfulness || 'N/A',
        old_proSocial: data?.old_proSocial || 'N/A',
        new_toxicity: data?.new_toxicity || 'N/A',
        new_empathy: data?.new_empathy || 'N/A',
        new_thoughtfulness: data?.new_thoughtfulness || 'N/A',
        new_proSocial: data?.new_proSocial || 'N/A',
        suggestion: rephrase_data?.rephrased_text || 'N/A',
    };
}

/**
 * Improve the user original text by focusing on selected categories
 * @param {string} original_text The current suggestion text
 * @param {string[]} selectedCategories e.g., ['toxicity','proSocial']
 */
export async function improveSuggestion(original_text, selectedCategories = []) {
    const payload = {
        user_input: original_text,
        improve_toxicity: selectedCategories.includes('toxicity'),
        improve_prosocial: selectedCategories.includes('proSocial'),
        improve_thoughtfulness: selectedCategories.includes('thoughtfulness'),
        improve_empathy: selectedCategories.includes('empathy')
    };
    const data = await request('/rephrase', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return data?.rephrased_text || data?.received_text || suggestion;
}

/**
 * Set the backend URL (useful for configuration)
 * @param {string} url - The backend URL
 */
export function setBackendURL(url) {
    BACKEND_URL = url;
}

/**
 * Get the current backend URL
 * @returns {string} The backend URL
 */
export function getBackendURL() {
    return BACKEND_URL;
}
