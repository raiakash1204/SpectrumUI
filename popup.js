/**
 * popup.js — Main logic for AccessUI Auditor popup
 */

(function () {
  'use strict';

  // ── DOM References ──
  const scanBtn = document.getElementById('scanBtn');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const keyStatus = document.getElementById('keyStatus');
  const loadingState = document.getElementById('loadingState');
  const loadingText = document.getElementById('loadingText');
  const errorState = document.getElementById('errorState');
  const errorText = document.getElementById('errorText');
  const resultsSection = document.getElementById('resultsSection');
  const emptyState = document.getElementById('emptyState');
  const scoreRingFill = document.getElementById('scoreRingFill');
  const scoreValue = document.getElementById('scoreValue');
  const violationCount = document.getElementById('violationCount');
  const passCount = document.getElementById('passCount');
  const incompleteCount = document.getElementById('incompleteCount');
  const violationsList = document.getElementById('violationsList');
  const exportBtn = document.getElementById('exportBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const aiStatus = document.getElementById('aiStatus');
  const aiStatusText = document.getElementById('aiStatusText');
  const toggleChatBtn = document.getElementById('toggleChatBtn');
  const chatPanel = document.getElementById('chatPanel');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const chatMessages = document.getElementById('chatMessages');
  const generatePromptBtn = document.getElementById('generatePromptBtn');
  const promptOutputBox = document.getElementById('promptOutputBox');
  const promptOutputText = document.getElementById('promptOutputText');
  const copyPromptBtn = document.getElementById('copyPromptBtn');
  const aiWarningBanner = document.getElementById('aiWarningBanner');

  // ── State ──
  let lastResults = null;
  let currentApiKey = '';

  // ── Build Fix Prompt ──
  function buildFixPrompt(scanResults) {
    const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    const sorted = [...scanResults.violations].sort((a, b) => {
      return (impactOrder[a.impact] || 3) - (impactOrder[b.impact] || 3);
    });

    // Build explanation lookup
    const expMap = {};
    if (scanResults.explanations) {
      for (const exp of scanResults.explanations) {
        expMap[exp.id] = exp;
      }
    }

    let prompt = 'You are a web developer. Fix ALL accessibility violations in the HTML code I will provide.\n\n';
    prompt += 'PAGE AUDITED: ' + (scanResults.url || 'Unknown') + '\n';
    prompt += 'ACCESSIBILITY SCORE: ' + scanResults.score + '/100\n';
    prompt += 'TOTAL VIOLATIONS: ' + sorted.length + '\n\n';
    prompt += 'Here are the violations to fix, in priority order:\n\n';

    sorted.forEach((v, i) => {
      const exp = expMap[v.id] || null;
      const severity = exp
        ? exp.severity
        : ((v.impact || 'minor').charAt(0).toUpperCase() + (v.impact || 'minor').slice(1));
      const issue = exp
        ? exp.plainEnglish
        : (v.description || v.help || 'Accessibility issue detected.');
      const affected = exp
        ? exp.whoIsAffected
        : 'Users with disabilities may be affected.';
      const brokenHtml = (v.nodes && v.nodes.length > 0 && v.nodes[0].html)
        ? v.nodes[0].html
        : 'N/A';
      const codefix = exp
        ? (exp.codefix || 'Refer to: ' + (v.helpUrl || 'https://dequeuniversity.com'))
        : 'Refer to: ' + (v.helpUrl || 'https://dequeuniversity.com');

      prompt += 'VIOLATION ' + (i + 1) + ' — ' + severity.toUpperCase() + ': ' + v.id + '\n';
      prompt += 'Issue: ' + issue + '\n';
      prompt += 'Affected users: ' + affected + '\n';
      prompt += 'Broken HTML: ' + brokenHtml + '\n';
      prompt += 'Required fix: ' + codefix + '\n\n';
    });

    prompt += 'INSTRUCTIONS:\n';
    prompt += '1. Fix every violation listed above in the HTML I provide\n';
    prompt += '2. Do not change anything else — layout, styles, content must stay the same\n';
    prompt += '3. For each fix, add an HTML comment above it: <!-- FIXED: [rule id] -->\n';
    prompt += '4. After applying all fixes, confirm which violations were resolved\n';
    prompt += '5. If a fix requires CSS changes, show them separately at the end\n\n';
    prompt += 'Now here is the HTML to fix:\n';
    prompt += '[PASTE YOUR HTML HERE]';

    return prompt;
  }

  // ── Score Calculation ──
  function calculateScore(violations) {
    const penalties = { critical: 12, serious: 8, moderate: 4, minor: 2 };
    let score = 100;
    for (const v of violations) {
      const impact = v.impact || 'minor';
      score -= (penalties[impact] || 2);
    }
    return Math.max(0, Math.min(100, score));
  }

  // ── Score Color ──
  function getScoreColor(score) {
    if (score >= 90) return '#06d6a0';
    if (score >= 70) return '#ffd166';
    if (score >= 50) return '#f4a261';
    return '#e63946';
  }

  // ── UI State Helpers ──
  function showLoading(text) {
    loadingText.textContent = text;
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    resultsSection.classList.add('hidden');
    emptyState.classList.add('hidden');
    scanBtn.disabled = true;
  }

  function hideLoading() {
    loadingState.classList.add('hidden');
    scanBtn.disabled = false;
  }

  function showError(message) {
    errorText.textContent = message;
    errorState.classList.remove('hidden');
    loadingState.classList.add('hidden');
    resultsSection.classList.add('hidden');
    emptyState.classList.add('hidden');
    scanBtn.disabled = false;
  }

  function showResults() {
    resultsSection.classList.remove('hidden');
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    emptyState.classList.add('hidden');
    scanBtn.disabled = false;
  }

  // ── Animate Score ──
  function animateScore(targetScore) {
    const circumference = 2 * Math.PI * 58; // r=58
    const color = getScoreColor(targetScore);

    scoreRingFill.style.stroke = color;

    // Animate the ring fill
    const offset = circumference - (targetScore / 100) * circumference;
    // Reset first
    scoreRingFill.style.transition = 'none';
    scoreRingFill.style.strokeDashoffset = circumference;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scoreRingFill.style.transition = 'stroke-dashoffset 1.2s ease-out';
        scoreRingFill.style.strokeDashoffset = offset;
      });
    });

    // Animate the number
    let current = 0;
    const duration = 1000;
    const startTime = performance.now();

    function updateNumber(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      current = Math.round(eased * targetScore);
      scoreValue.textContent = current;
      scoreValue.style.color = color;
      if (progress < 1) {
        requestAnimationFrame(updateNumber);
      }
    }

    requestAnimationFrame(updateNumber);
  }

  // ── Severity Badge ──
  function createSeverityBadge(severity) {
    const badge = document.createElement('span');
    const sev = (severity || 'minor').toLowerCase();
    badge.className = `severity-badge severity-${sev}`;
    badge.textContent = severity || 'Minor';
    return badge;
  }

  // ── Build Violation Card ──
  function buildViolationCard(violation, explanation, index) {
    const card = document.createElement('div');
    card.className = 'violation-card';

    const selector = violation.nodes && violation.nodes.length > 0
      ? (violation.nodes[0].target ? violation.nodes[0].target.join(', ') : '')
      : '';

    const severity = explanation ? explanation.severity : (
      (violation.impact || 'minor').charAt(0).toUpperCase() + (violation.impact || 'minor').slice(1)
    );

    const description = explanation
      ? explanation.plainEnglish
      : (violation.description || violation.help || 'Accessibility issue detected.');

    const whoAffected = explanation
      ? explanation.whoIsAffected
      : '';

    const codefix = explanation
      ? explanation.codefix
      : '';

    // Header
    const header = document.createElement('div');
    header.className = 'violation-card-header';

    // Top row: severity + id
    const topRow = document.createElement('div');
    topRow.className = 'violation-card-top';
    topRow.appendChild(createSeverityBadge(severity));

    const idSpan = document.createElement('span');
    idSpan.className = 'violation-id';
    idSpan.textContent = violation.id;
    topRow.appendChild(idSpan);
    header.appendChild(topRow);

    // Description
    const descEl = document.createElement('p');
    descEl.className = 'violation-description';
    descEl.textContent = description;
    header.appendChild(descEl);

    // Who is affected
    if (whoAffected) {
      const whoEl = document.createElement('p');
      whoEl.className = 'violation-who';
      whoEl.textContent = '👤 ' + whoAffected;
      header.appendChild(whoEl);
    }

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'violation-actions';

    if (codefix) {
      const fixBtn = document.createElement('button');
      fixBtn.className = 'btn-small';
      fixBtn.textContent = '🔧 View Code Fix';
      fixBtn.addEventListener('click', () => {
        const section = card.querySelector('.codefix-section');
        section.classList.toggle('expanded');
        fixBtn.textContent = section.classList.contains('expanded')
          ? '🔧 Hide Code Fix'
          : '🔧 View Code Fix';
      });
      actions.appendChild(fixBtn);
    }

    if (selector) {
      const highlightBtn = document.createElement('button');
      highlightBtn.className = 'btn-small btn-highlight';
      highlightBtn.textContent = '🎯 Highlight';
      highlightBtn.addEventListener('click', () => {
        highlightElement(selector);
      });
      actions.appendChild(highlightBtn);
    }

    header.appendChild(actions);
    card.appendChild(header);

    // Code fix section (collapsed by default)
    if (codefix) {
      const fixSection = document.createElement('div');
      fixSection.className = 'codefix-section';

      const fixContent = document.createElement('div');
      fixContent.className = 'codefix-content';

      const fixLabel = document.createElement('div');
      fixLabel.className = 'codefix-label';
      fixLabel.textContent = 'Suggested Fix';
      fixContent.appendChild(fixLabel);

      const fixBlock = document.createElement('pre');
      fixBlock.className = 'codefix-block';
      fixBlock.textContent = codefix;
      fixContent.appendChild(fixBlock);

      fixSection.appendChild(fixContent);
      card.appendChild(fixSection);
    }

    return card;
  }

  // ── Render Results ──
  function renderResults(scanData, explanations, aiAvailable) {
    const score = calculateScore(scanData.violations);

    // Animate score
    animateScore(score);

    // Summary counts
    violationCount.textContent = scanData.violations.length;
    passCount.textContent = scanData.passes;
    incompleteCount.textContent = scanData.incomplete;

    // AI status
    if (!aiAvailable) {
      aiStatus.classList.remove('hidden');
      aiStatusText.textContent = 'AI explanations unavailable — showing raw axe-core descriptions.';
    } else {
      aiStatus.classList.add('hidden');
    }

    // Clear violations list
    violationsList.innerHTML = '';

    if (scanData.violations.length === 0) {
      const noVio = document.createElement('div');
      noVio.className = 'no-violations';
      noVio.innerHTML = `
        <div class="no-violations-icon">🎉</div>
        <div class="no-violations-text">No violations found!</div>
        <div class="no-violations-sub">This page passed all automated accessibility checks.</div>
      `;
      violationsList.appendChild(noVio);
    } else {
      // Build explanation lookup map
      const explanationMap = {};
      if (explanations) {
        for (const exp of explanations) {
          explanationMap[exp.id] = exp;
        }
      }

      // Sort: critical first, then serious, moderate, minor
      const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
      const sorted = [...scanData.violations].sort((a, b) => {
        return (impactOrder[a.impact] || 3) - (impactOrder[b.impact] || 3);
      });

      sorted.forEach((violation, idx) => {
        const explanation = explanationMap[violation.id] || null;
        const card = buildViolationCard(violation, explanation, idx);
        violationsList.appendChild(card);
      });
    }

    showResults();
  }

  // ── Highlight Element on Page ──
  function highlightElement(selector) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      // First clear existing highlights
      chrome.runtime.sendMessage({
        action: 'relayToContent',
        tabId: tabs[0].id,
        payload: { action: 'clearHighlights' }
      }, () => {
        // Then highlight the element
        chrome.runtime.sendMessage({
          action: 'relayToContent',
          tabId: tabs[0].id,
          payload: { action: 'highlightElement', selector: selector }
        });
      });
    });
  }

  // ── Run Scan ──
  async function runScan() {
    // Check for API key
    const apiKey = apiKeyInput.value.trim();

    // Get active tab
    let tabs;
    try {
      tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    } catch (e) {
      showError('Could not access the active tab.');
      return;
    }

    if (!tabs || tabs.length === 0) {
      showError('No active tab found.');
      return;
    }

    const tab = tabs[0];

    // Check if page is scannable
    if (tab.url && (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('brave://') ||
      tab.url.startsWith('devtools://') ||
      tab.url === ''
    )) {
      showError('Cannot scan this page. Chrome internal pages (chrome://, about:, etc.) do not allow extensions to inject scripts.');
      return;
    }

    // Show loading
    showLoading('Running accessibility scan...');

    try {
      // Send scan message via background
      const scanData = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'relayToContent',
          tabId: tab.id,
          payload: { action: 'runScan' }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        });
      });

      if (!scanData || !scanData.violations) {
        showError('Scan returned no data. The content script may not be loaded on this page. Try refreshing the page.');
        return;
      }

      lastResults = {
        url: scanData.url || tab.url,
        timestamp: new Date().toISOString(),
        score: calculateScore(scanData.violations),
        summary: {
          violations: scanData.violations.length,
          passes: scanData.passes,
          incomplete: scanData.incomplete
        },
        violations: scanData.violations,
        explanations: null
      };

      // Try AI explanations if API key present and there are violations
      let explanations = null;
      let aiAvailable = false;

      if (apiKey && scanData.violations.length > 0) {
        showLoading('Asking Gemini AI for explanations...');
        try {
          explanations = await explainViolations(scanData.violations, apiKey);
          aiAvailable = true;
          lastResults.explanations = explanations;
        } catch (err) {
          console.error('AI explanations failed:', err);
          aiAvailable = false;
        }
      } else if (!apiKey && scanData.violations.length > 0) {
        // No API key — generate fallback explanations
        explanations = scanData.violations.map(v => ({
          id: v.id,
          plainEnglish: v.description || v.help || 'Accessibility violation detected.',
          whoIsAffected: 'Users with disabilities may be affected.',
          codefix: v.nodes && v.nodes.length > 0
            ? `<!-- Current HTML -->\n${v.nodes[0].html}\n\n<!-- Refer to: ${v.helpUrl || 'https://dequeuniversity.com'} -->`
            : '',
          severity: (v.impact || 'minor').charAt(0).toUpperCase() + (v.impact || 'minor').slice(1)
        }));
        aiAvailable = false;
      }

      hideLoading();
      lastResults.score = calculateScore(scanData.violations);
      renderResults(scanData, explanations, aiAvailable);

      // Check if any explanation contains the fallback text and show warning banner
      if (aiWarningBanner && explanations && explanations.length > 0) {
        const hasFallback = explanations.some(e =>
          e.codefix && e.codefix.startsWith('AI explanation unavailable')
        );
        aiWarningBanner.style.display = hasFallback ? '' : 'none';
      }

      // Store results for PDF generation and show the download button
      window.lastScanResults = {
        url: lastResults.url,
        score: lastResults.score,
        violations: lastResults.violations,
        explanations: lastResults.explanations,
        passes: typeof scanData.passes === 'number' ? scanData.passes : 0,
        incomplete: typeof scanData.incomplete === 'number' ? scanData.incomplete : 0,
        timestamp: lastResults.timestamp
      };
      downloadPdfBtn.classList.remove('hidden');

      // Show Generate Fix Prompt button if there are violations
      if (scanData.violations.length > 0) {
        generatePromptBtn.style.display = '';
      } else {
        generatePromptBtn.style.display = 'none';
      }

      // Show AI Chat toggle and initialize chatbot
      const savedApiKey = apiKeyInput.value.trim();
      if (savedApiKey && window.Chatbot) {
        toggleChatBtn.style.display = '';
        window.Chatbot.init(chatMessages, savedApiKey, window.lastScanResults);
      }

    } catch (error) {
      console.error('Scan error:', error);
      showError('Scan failed: ' + error.message + '. Try refreshing the page and scanning again.');
    }
  }

  // ── Export JSON ──
  function exportReport() {
    if (!lastResults) return;

    const blob = new Blob([JSON.stringify(lastResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accessui-report.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Save API Key ──
  function saveApiKey() {
    const key = apiKeyInput.value.trim();
    chrome.storage.local.set({ geminiApiKey: key }, () => {
      currentApiKey = key;
      keyStatus.classList.remove('hidden');
      if (key) {
        keyStatus.className = 'key-status success';
        keyStatus.textContent = '✓ API key saved';
      } else {
        keyStatus.className = 'key-status success';
        keyStatus.textContent = '✓ API key cleared';
      }
      setTimeout(() => {
        keyStatus.classList.add('hidden');
      }, 2500);
    });
  }

  // ── Load API Key ──
  function loadApiKey() {
    chrome.storage.local.get('geminiApiKey', (data) => {
      if (data.geminiApiKey) {
        apiKeyInput.value = data.geminiApiKey;
        currentApiKey = data.geminiApiKey;
      }
    });
  }

  // ── Event Listeners ──
  scanBtn.addEventListener('click', runScan);
  saveKeyBtn.addEventListener('click', saveApiKey);
  exportBtn.addEventListener('click', exportReport);
  downloadPdfBtn.addEventListener('click', () => {
    if (window.lastScanResults && typeof window.generatePDFReport === 'function') {
      window.generatePDFReport(window.lastScanResults);
    }
  });

  // ── Generate Fix Prompt ──
  generatePromptBtn.addEventListener('click', () => {
    if (!window.lastScanResults) return;
    const prompt = buildFixPrompt(window.lastScanResults);
    promptOutputText.value = prompt;
    promptOutputBox.style.display = '';
    promptOutputBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // ── Copy Fix Prompt ──
  copyPromptBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(promptOutputText.value).then(() => {
      copyPromptBtn.textContent = 'Copied! ✓';
      promptOutputText.classList.add('flash-green');
      setTimeout(() => {
        copyPromptBtn.textContent = 'Copy ✓';
        promptOutputText.classList.remove('flash-green');
      }, 2000);
    });
  });

  // Handle Enter key in API key input
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveApiKey();
    }
  });

  // ── Chat Event Listeners ──
  toggleChatBtn.addEventListener('click', () => {
    const isOpen = chatPanel.style.display !== 'none';
    chatPanel.style.display = isOpen ? 'none' : 'flex';
    toggleChatBtn.textContent = isOpen ? '✦ AI Chat' : '✕ Close Chat';
    toggleChatBtn.classList.toggle('chat-active', !isOpen);
  });

  chatSendBtn.addEventListener('click', () => {
    const msg = chatInput.value.trim();
    if (msg && window.Chatbot) {
      window.Chatbot.sendMessage(msg);
      chatInput.value = '';
    }
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const msg = chatInput.value.trim();
      if (msg && window.Chatbot) {
        window.Chatbot.sendMessage(msg);
        chatInput.value = '';
      }
    }
  });

  clearChatBtn.addEventListener('click', () => {
    if (window.Chatbot) {
      window.Chatbot.clear();
    }
  });

  // ── Init ──
  document.addEventListener('DOMContentLoaded', () => {
    loadApiKey();
  });

  // Also try loading immediately (DOMContentLoaded may have already fired)
  loadApiKey();

})();
