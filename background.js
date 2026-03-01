/**
 * background.js — Service worker for AccessUI Auditor
 * Relays messages between popup/sidepanel and content.js.
 */

// ── Side Panel: open on icon click ──
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ── Side Panel: configure on install ──
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled: true
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  // Handle captureElement action for screenshot feature
  if (message.action === 'captureElement') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // First tell content script to highlight and get rect
        const result = await chrome.tabs.sendMessage(tab.id, {
          action: 'highlightElement',
          selector: message.selector
        });

        if (!result || !result.success) {
          sendResponse({ success: false, error: 'Element not found' });
          return;
        }

        // Capture screenshot of the full visible tab
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png'
        });

        sendResponse({
          success: true,
          screenshot: dataUrl,
          rect: result.rect
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // async
  }

  if (message.action !== 'relayToContent') {
    return false;
  }

  const { tabId, payload } = message;

  if (!tabId || !payload) {
    sendResponse({ error: 'Invalid relay request: missing tabId or payload.' });
    return false;
  }

  chrome.tabs.sendMessage(tabId, payload, (response) => {
    if (chrome.runtime.lastError) {
      const errorMsg = chrome.runtime.lastError.message || 'Unknown error';

      // Provide friendly error messages
      if (errorMsg.includes('Could not establish connection') ||
          errorMsg.includes('Receiving end does not exist')) {
        sendResponse({
          error: 'Content script is not loaded on this page. This can happen on chrome:// pages, PDF files, or pages with strict Content Security Policy. Try refreshing the page.'
        });
      } else {
        sendResponse({ error: 'Communication error: ' + errorMsg });
      }
      return;
    }

    sendResponse(response);
  });

  return true; // Keep the message channel open for async response
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger-scan') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      // Cannot scan this page — show a notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'AccessUI Auditor',
        message: 'Cannot scan this page. Try on a regular website.'
      });
      return;
    }

    // Store a flag in chrome.storage.local so the popup knows to auto-scan
    await chrome.storage.local.set({ autoScan: true, autoScanTabId: tab.id });

    // Open the popup programmatically
    chrome.action.openPopup();
  }
});
