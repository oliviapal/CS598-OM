/**
 * Get color class for score badge
 */
export function getScoreColor(category, value) {
    const v = String(value).toLowerCase();
    if (category === 'toxicity') {
        if (v.includes('low')) return 'score-green';
        if (v.includes('medium')) return 'score-yellow';
        if (v.includes('high')) return 'score-red';
    } else {
        if (v.includes('high')) return 'score-green';
        if (v.includes('medium')) return 'score-yellow';
        if (v.includes('low')) return 'score-red';
    }
    return '';
}