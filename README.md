# CS598-OM
CS 598 Online Moderation Project

## Running the backend

This project uses:

- Python 3.11.14

To reproduce the environment:

```bash
conda env create -f environment.yml
```

To install FastAPI:
```bash
pip install "fastapi[standard]"
```

To run the backend server:

```bash
fastapi dev backend/main.py
```

## Running the front end

### Installation
1. Install dependencies:
```bash
npm install
```

### Build the Extension
2. Build the extension files:
```bash
npm run build
```
This compiles all source files from `src/` into the `build/` directory using Webpack.

### Load Extension in Chrome
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top-right corner)
5. Click "Load unpacked"
6. Select the `build/` folder from this project
7. The extension should now appear in your extensions list

### Usage
8. Navigate to a site (we've mainly tested with Outlook and Discord, but it should theoretically work on any site)
9. Accept the permissions by clicking on the puzzle piece in the top bar, then clicking on Socially, and then clicking to temporarily accept the permissions.
10. Look for the green "S" button attached to editable text fields
11. Type some text, then click the "S" button to analyze
12. Follow the popup flow: select improvement categories → view results → accept or dismiss suggestion 


## Front End Files

### Core Extension Files
- **`script.js`** - Main content script entry point that initializes the extension on web pages
- **`background.js`** - Service worker that handles extension permissions, script injection, and API proxy for localhost calls (bypasses Private Network Access restrictions)
- **`popup.html`** / **`popup.js`** - Extension popup UI for enabling/disabling the extension on specific sites

### UI Components (Popups)
- **`results-popup.js`** - Main analysis results modal that displays toxicity/empathy/politeness/pro-social scores (original → improved) and suggested rephrased text with Accept/Dismiss actions
- **`improve-popup.js`** - Category selection modal shown before results, allows users to choose which aspects to improve (toxicity, empathy, politeness, pro-social) with score badges
- **`confirm-popup.js`** - Confirmation dialog for showing improved text with Accept/Dismiss options

### Functionality Modules
- **`api.js`** - Backend communication layer that routes all fetch requests through the background script proxy to call the FastAPI server (`http://127.0.0.1:8000`)
- **`editor-attachment.js`** - Manages the green "S" button attachment to editable elements (textarea, contenteditable) and handles click events to trigger analysis
- **`mutation-observer.js`** - Watches for DOM changes and dynamically attaches the S button to new editable elements
- **`helpers.js`** - Utility functions for score color mapping (green/yellow/red badges based on score values)
- **`utils.js`** - General utility functions for text extraction and element manipulation
- **`selectors.js`** - CSS selectors for finding editable elements across different web platforms (Gmail, Outlook, etc.)

### Testing & Styling
- **`test-popup.js`** - Testing utilities for popup functionality
- **`script.css`** - All popup styles including score badges, loading spinners, action buttons, and animations