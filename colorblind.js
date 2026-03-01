/**
 * colorblind.js — Colour Blindness Simulator for SpectrumUI
 * Sends messages to content.js to apply/remove SVG color matrix filters.
 */

(function () {
  'use strict';

  let _activeFilter = null;

  async function getActiveTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ? tab.id : null;
  }

  async function apply(type) {
    const tabId = await getActiveTabId();
    if (!tabId) return;

    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'applyColorFilter',
        type: type
      });
      _activeFilter = type === 'normal' ? null : type;
      chrome.storage.local.set({ lastColorSim: type });
    } catch (err) {
      console.warn('ColorBlindSim.apply failed:', err);
    }
  }

  async function remove() {
    const tabId = await getActiveTabId();
    if (!tabId) return;

    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'removeColorFilter'
      });
    } catch (err) {
      console.warn('ColorBlindSim.remove failed:', err);
    }
    _activeFilter = null;
    chrome.storage.local.set({ lastColorSim: 'normal' });
  }

  function current() {
    return _activeFilter;
  }

  window.ColorBlindSim = { apply, remove, current };
})();
