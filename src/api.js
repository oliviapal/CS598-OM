// api.js
// Backend API communication

// TODO: Replace with your actual backend URL
const BACKEND_URL = 'http://localhost:5000'; // Example: change this to your backend URL

/**
 * Analyze text using the backend API
 * @param {string} text - The text to analyze
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeText(text) {
    // Testing
    return {
        toxicity: "Low",
        empathy: "Medium",
        thoughtfulness: "High",
        proSocial: "High",
        suggestion: "I really appreciate your perspective on this matter. It would be great if we could discuss this further and find a solution that works for everyone."
    };

    try {
        const response = await fetch(`${BACKEND_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server returned status ${response.status}`);
        }

        const data = await response.json();

        // Validate the response structure
        if (!data.toxicity || !data.empathy || !data.thoughtfulness || !data.proSocial || !data.suggestion) {
            throw new Error('Invalid response format from backend');
        }

        return {
            toxicity: data.toxicity,
            empathy: data.empathy,
            thoughtfulness: data.thoughtfulness,
            proSocial: data.proSocial,
            suggestion: data.suggestion
        };

    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
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
