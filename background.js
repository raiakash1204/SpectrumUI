/**
 * background.js — Service worker for AccessUI Auditor
 * Relays messages between popup.js and content.js.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.action !== 'relayToContent') {
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
