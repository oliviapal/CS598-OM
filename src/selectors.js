// selectors.js
export function getPrioritySelectors(url) {
    // Outlook
    if (url.includes('outlook.office.com')) {
        return [
            'div[role="textbox"][aria-label*="Message body"]',
        ];

    // Reddit
    } else if (url.includes('reddit.com')) {
        return [
            'div[role="textbox"][contenteditable="true"]',
        ];
    }

    // Default case for other websites
    return [];
    /*
    return [
        'div[role="textbox"][aria-multiline="true"]',
        '[contenteditable="true"]',
    ];
    */
}