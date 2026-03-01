/**
 * content.js — Injected into web pages by AccessUI Auditor
 * Runs axe-core scans and handles element highlighting.
 */

(function () {
  'use strict';

  const HIGHLIGHT_CLASS = 'accessui-auditor-highlight';

  // Inject highlight styles once
  function injectHighlightStyles() {
    if (document.getElementById('accessui-highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'accessui-highlight-styles';
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: 3px solid #e63946 !important;
        outline-offset: 2px !important;
        background-color: rgba(230, 57, 70, 0.08) !important;
        transition: outline 0.3s ease, background-color 0.3s ease !important;
      }
    `;
    document.head.appendChild(style);
  }

  injectHighlightStyles();

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return false;

    switch (message.action) {
      case 'runScan':
        runAccessibilityScan()
          .then(results => sendResponse(results))
          .catch(error => sendResponse({ error: error.message }));
        return true; // Keep message channel open for async response

      case 'highlightElement':
        (async () => {
          const result = await highlightElementAndGetRect(message.selector);
          sendResponse(result);
        })();
        return true; // async

      case 'clearHighlights':
        clearHighlights();
        sendResponse({ success: true });
        return false;

      default:
        return false;
    }
  });

  /**
   * Run the axe-core accessibility scan on the current document.
   */
  async function runAccessibilityScan() {
    // Ensure axe is available
    if (typeof axe === 'undefined') {
      throw new Error('axe-core is not loaded. Make sure lib/axe.min.js is present.');
    }

    try {
      const results = await axe.run(document, { reporter: 'v2' });

      return {
        violations: results.violations || [],
        passes: results.passes ? results.passes.length : 0,
        incomplete: results.incomplete ? results.incomplete.length : 0,
        url: window.location.href
      };
    } catch (error) {
      console.error('AccessUI Auditor — axe.run failed:', error);
      throw new Error('axe-core scan failed: ' + error.message);
    }
  }

  /**
   * Highlight an element on the page using a CSS selector.
   */
  function highlightElement(selector) {
    if (!selector) return;

    try {
      const element = document.querySelector(selector);
      if (element) {
        // Add highlight class
        element.classList.add(HIGHLIGHT_CLASS);

        // Scroll into view
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    } catch (error) {
      console.warn('AccessUI Auditor — Could not highlight element:', selector, error);
    }
  }

  /**
   * Highlight an element and return its bounding rect for screenshot cropping.
   */
  async function highlightElementAndGetRect(selector) {
    if (!selector) return { success: false };

    try {
      const el = document.querySelector(selector);
      if (!el) return { success: false };

      // Remove previous highlights
      clearHighlights();

      // Add highlight class
      el.classList.add(HIGHLIGHT_CLASS);

      // Scroll into view
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

      // Wait for scroll to settle, then return bounding rect
      await new Promise(r => setTimeout(r, 600));
      const rect = el.getBoundingClientRect();
      return {
        success: true,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          devicePixelRatio: window.devicePixelRatio || 1
        }
      };
    } catch (error) {
      console.warn('AccessUI Auditor — Could not highlight element:', selector, error);
      return { success: false };
    }
  }

  /**
   * Remove all highlights added by the extension.
   */
  function clearHighlights() {
    const highlighted = document.querySelectorAll('.' + HIGHLIGHT_CLASS);
    highlighted.forEach(el => {
      el.classList.remove(HIGHLIGHT_CLASS);
    });
  }

})();
