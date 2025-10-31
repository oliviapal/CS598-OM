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
    // NOTE: Backend currently exposes POST /rephrase; using that until /analyze exists
    // We map response into the UI shape expected by the results popup.
    const payload = {
        user_input: text,
        improve_toxicity: false,
        improve_prosocial: false,
    };
    const data = await request('/rephrase', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    // Backend demo echoes input; prefer a rephrased field if present
    const suggestion = data?.rephrased_text || data?.received_text || text;

    // Placeholder scores until backend provides them. Adjust if backend adds scoring.
    return {
        toxicity: 'Low',
        empathy: 'Medium',
        thoughtfulness: 'High',
        proSocial: 'High',
        suggestion,
    };
}

/**
 * Improve an existing suggestion focused on selected categories
 * @param {string} suggestion The current suggestion text
 * @param {string[]} selectedCategories e.g., ['toxicity','proSocial']
 */
export async function improveSuggestion(suggestion, selectedCategories = []) {
    const payload = {
        user_input: suggestion,
        improve_toxicity: selectedCategories.includes('toxicity'),
        improve_prosocial: selectedCategories.includes('proSocial'),
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
