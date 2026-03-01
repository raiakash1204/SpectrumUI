/**
 * content.js — Injected into web pages by SpectrumUI
 * Runs axe-core scans and handles element highlighting.
 */

(function () {
  'use strict';

  const HIGHLIGHT_CLASS = 'spectrumui-highlight';

  // Inject highlight styles once
  function injectHighlightStyles() {
    if (document.getElementById('spectrumui-highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'spectrumui-highlight-styles';
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

      case 'detectFramework':
        (() => {
          const framework = (() => {
            if (window.__NEXT_DATA__) return 'nextjs';
            if (window.__nuxt__ || window.__vue__) return 'vue';
            if (document.querySelector('[ng-version]')) return 'angular';
            if (document.querySelector('[data-svelte]')) return 'svelte';
            if (window.React || document.querySelector('[data-reactroot]')) return 'react';
            return 'html';
          })();
          sendResponse({ framework });
        })();
        return true;

      case 'applyColorFilter':
        (() => {
          // Remove any existing filter
          const existing = document.getElementById('spectrumui-colorfilter');
          if (existing) existing.remove();
          document.documentElement.style.filter = '';

          if (message.type === 'normal') {
            sendResponse({ success: true });
            return;
          }

          if (message.type === 'contrast') {
            document.documentElement.style.filter = 'contrast(0.4) brightness(1.1)';
            sendResponse({ success: true });
            return;
          }

          const matrices = {
            deuteranopia:  '0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0',
            protanopia:    '0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0',
            tritanopia:    '1.256 -0.077 -0.179 0 0  -0.078 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0',
            achromatopsia: '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0'
          };

          const matrix = matrices[message.type];
          if (!matrix) { sendResponse({ success: false }); return; }

          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.id = 'spectrumui-colorfilter';
          svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
          svg.innerHTML = '<defs><filter id="spectrumui-cbfilter"><feColorMatrix type="matrix" values="' + matrix + '"/></filter></defs>';
          document.body.appendChild(svg);

          document.documentElement.style.filter = 'url(#spectrumui-cbfilter)';
          sendResponse({ success: true });
        })();
        return true;

      case 'removeColorFilter':
        (() => {
          const svg = document.getElementById('spectrumui-colorfilter');
          if (svg) svg.remove();
          document.documentElement.style.filter = '';
          sendResponse({ success: true });
        })();
        return true;

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

    // Temporarily remove colour blindness filter so axe sees real colours
    const savedFilter = document.documentElement.style.filter;
    const existingSvg = document.getElementById('spectrumui-colorfilter');
    if (savedFilter || existingSvg) {
      document.documentElement.style.filter = '';
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
      console.error('SpectrumUI — axe.run failed:', error);
      throw new Error('axe-core scan failed: ' + error.message);
    } finally {
      // Restore the colour filter after scanning
      if (savedFilter) {
        document.documentElement.style.filter = savedFilter;
      }
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
      console.warn('SpectrumUI — Could not highlight element:', selector, error);
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
      console.warn('SpectrumUI — Could not highlight element:', selector, error);
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
