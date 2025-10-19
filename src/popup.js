document.getElementById('enable').addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.textContent = 'Requesting permission...';
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0] || !tabs[0].url) {
      status.textContent = 'No active tab or URL.';
      return;
    }
    const tab = tabs[0];
    let origin;
    try { origin = new URL(tab.url).origin; } catch (e) { status.textContent = 'Unsupported page (no origin).'; return; }

    // Send message and handle async response with timeout
    let responded = false;
    const timeout = setTimeout(() => {
      if (!responded) {
        status.textContent = 'No response from background (timeout). Check service worker logs.';
      }
    }, 5000);

    chrome.runtime.sendMessage({ type: 'request-permission', origin, tabId: tab.id }, (resp) => {
      responded = true;
      clearTimeout(timeout);
      console.log('popup: permission response', resp);
      if (!resp) {
        status.textContent = 'No response from background.';
        return;
      }
      if (resp.granted && resp.injected) {
        status.textContent = 'Enabled on this site — injected script.';
      } else if (resp.granted && !resp.injected) {
        status.textContent = 'Permission granted but injection failed: ' + (resp.error || 'unknown');
      } else if (resp.reason === 'user_denied') {
        status.textContent = 'Permission denied by user.';
      } else if (resp.error) {
        status.textContent = 'Permission request failed: ' + resp.error;
      } else {
        status.textContent = 'Permission denied or failed.';
      }
    });
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
  }
});

// Temporary enable button: uses activeTab injection (no host permission requested)
const tempBtn = document.createElement('button');
tempBtn.textContent = 'Temporary enable on this page';
tempBtn.style.display = 'block';
tempBtn.style.marginTop = '8px';
document.body.appendChild(tempBtn);

tempBtn.addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.textContent = 'Temporarily enabling on this page...';
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0] || !tabs[0].id) {
      status.textContent = 'No active tab.';
      return;
    }
    const tabId = tabs[0].id;
    chrome.runtime.sendMessage({ type: 'inject-now', tabId }, (resp) => {
      console.log('popup: inject-now response', resp);
      if (resp && resp.ok) status.textContent = 'Temporarily enabled on this page.';
      else status.textContent = 'Temporary enable failed: ' + (resp && resp.error ? resp.error : 'unknown');
    });
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
  }
});
