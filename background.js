// On install and on browser startup, configure the side panel
// to open automatically when the extension icon is clicked
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(err => console.error('setPanelBehavior failed:', err));

  chrome.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled: true
  }).catch(err => console.error('setOptions failed:', err));
});

// Also set it on service worker startup (in case onInstalled already fired)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {}); // silently ignore if called too early

// Handle icon click as a fallback — call open() SYNCHRONOUSLY
// with no await before it so the user gesture is preserved
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id })
    .catch(() => {
      // Fallback: if open() fails, setPanelBehavior should handle it
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch(() => {});
    });
});

// Relay messages between popup/sidepanel and content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'relayToContent') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (!tab) { sendResponse({ error: 'No active tab' }); return; }
        chrome.tabs.sendMessage(tab.id, msg.payload)
          .then(sendResponse)
          .catch(err => sendResponse({ error: err.message }));
      });
    return true;
  }
});

// Handle keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger-scan') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const unscannable = ['chrome://', 'edge://', 'chrome-extension://'];
    if (unscannable.some(p => tab.url.startsWith(p))) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'SpectrumUI',
        message: 'Cannot scan this page. Try on a regular website.'
      });
      return;
    }

    await chrome.storage.local.set({ autoScan: true, autoScanTabId: tab.id });
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
});
