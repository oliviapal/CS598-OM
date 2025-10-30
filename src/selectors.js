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

        // Discord
    } else if (url.includes('discord.com')) {
        return [
            'div[role="textbox"][contenteditable="true"]',
        ];


        // Default case for other websites
    } else {
        return [
            'div[role="textbox"][aria-multiline="true"]',
            '[contenteditable="true"]',
        ];
    }
}