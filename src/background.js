// background.js
// Handles runtime permission requests and injects content script + CSS into the tab

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'request-permission') return;
  (async () => {
    try {
      const origin = msg.origin; // e.g. https://example.com
      const tabId = msg.tabId;
      if (!origin || !tabId) {
        console.warn('request-permission missing origin or tabId', msg);
        sendResponse({ granted: false, error: 'missing origin or tabId' });
        return;
      }
      const originPattern = origin + '/*';
      console.log('background: permission request for', originPattern, 'from tab', tabId);

      // First, check if permission already granted
      chrome.permissions.contains({ origins: [originPattern] }, (contains) => {
        if (contains) {
          console.log('background: permission already granted for', originPattern);
          // Inject and respond
            chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['script.js'] }, () => {
            const execErr = chrome.runtime.lastError;
            if (execErr) {
              console.error('executeScript error', execErr);
              sendResponse({ granted: true, injected: false, error: String(execErr) });
              return;
            }
              chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['script.css'] }, () => {
              const cssErr = chrome.runtime.lastError;
              if (cssErr) {
                console.error('insertCSS error', cssErr);
                sendResponse({ granted: true, injected: false, error: String(cssErr) });
                return;
              }
              sendResponse({ granted: true, injected: true, reason: 'already_granted' });
            });
          });
          return;
        }

        // Request host permission for this origin
        chrome.permissions.request({ origins: [originPattern] }, (granted) => {
          console.log('background: permissions.request callback, granted=', granted);
          if (granted) {
            // Try to inject JS then CSS
              chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['script.js'] }, () => {
              const execErr = chrome.runtime.lastError;
              if (execErr) {
                console.error('executeScript error after grant', execErr);
                sendResponse({ granted: true, injected: false, error: String(execErr) });
                return;
              }
                chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['script.css'] }, () => {
                const cssErr = chrome.runtime.lastError;
                if (cssErr) {
                  console.error('insertCSS error after grant', cssErr);
                  sendResponse({ granted: true, injected: false, error: String(cssErr) });
                  return;
                }
                sendResponse({ granted: true, injected: true });
              });
            });
          } else {
            console.warn('background: user denied permission for', originPattern);
            sendResponse({ granted: false, reason: 'user_denied' });
          }
        });
      });
    } catch (err) {
      console.error('background error', err);
      sendResponse({ granted: false, error: String(err) });
    }
  })();
  // Return true to indicate we'll call sendResponse asynchronously
  return true;
});

// Handle a direct injection request using activeTab (no host permission required if user clicked extension)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'inject-now') return;
  const tabId = msg.tabId;
  if (!tabId) {
    sendResponse({ ok: false, error: 'missing tabId' });
    return;
  }
  console.log('background: inject-now for tab', tabId);
    chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['script.js'] }, () => {
    const execErr = chrome.runtime.lastError;
    if (execErr) {
      console.error('executeScript inject-now error', execErr);
      sendResponse({ ok: false, error: String(execErr) });
      return;
    }
      chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['script.css'] }, () => {
      const cssErr = chrome.runtime.lastError;
      if (cssErr) {
        console.error('insertCSS inject-now error', cssErr);
        sendResponse({ ok: false, error: String(cssErr) });
        return;
      }
      sendResponse({ ok: true });
    });
  });
  return true;
});
