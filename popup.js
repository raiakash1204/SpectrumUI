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
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');

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
    card.dataset.impact = violation.impact || 'minor';

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
      highlightBtn.addEventListener('click', async () => {
        highlightBtn.textContent = '📸 Capturing...';
        highlightBtn.disabled = true;

        try {
          const response = await chrome.runtime.sendMessage({
            action: 'captureElement',
            selector: selector
          });

          highlightBtn.textContent = '🎯 Highlight';
          highlightBtn.disabled = false;

          if (response && response.success) {
            cropAndShowScreenshot(response.screenshot, response.rect, card);
          }
        } catch (err) {
          highlightBtn.textContent = '🎯 Highlight';
          highlightBtn.disabled = false;
          console.warn('Screenshot capture failed:', err);
        }
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

    // Build severity filter bar
    if (scanData.violations.length > 0) {
      buildFilterBar(scanData.violations);
    }
  }

  // ── Severity Filter Bar ──
  function buildFilterBar(violations) {
    const counts = { all: violations.length, critical: 0, serious: 0, moderate: 0, minor: 0 };
    violations.forEach(v => { if (counts[v.impact] !== undefined) counts[v.impact]++; });

    const chips = [
      { label: 'All',      key: 'all',      color: '#818cf8' },
      { label: 'Critical', key: 'critical',  color: '#e63946' },
      { label: 'Serious',  key: 'serious',   color: '#f4a261' },
      { label: 'Moderate', key: 'moderate',  color: '#ffd166' },
      { label: 'Minor',    key: 'minor',     color: '#60a5fa' },
    ];

    const filterChips = document.getElementById('filterChips');
    const filterCount = document.getElementById('filterCount');
    const filterBar = document.getElementById('filterBar');

    filterChips.innerHTML = '';

    chips.forEach(chip => {
      // Hide chips with 0 count (except All)
      if (chip.key !== 'all' && counts[chip.key] === 0) return;

      const btn = document.createElement('button');
      btn.className = 'filter-chip' + (chip.key === 'all' ? ' active' : '');
      btn.dataset.filter = chip.key;

      if (chip.key === 'all') {
        btn.style.background = chip.color;
        btn.style.color = 'white';
      }

      const labelSpan = document.createElement('span');
      labelSpan.className = 'chip-label';
      labelSpan.textContent = chip.label;
      btn.appendChild(labelSpan);

      const countSpan = document.createElement('span');
      countSpan.className = 'chip-count';
      countSpan.textContent = counts[chip.key];
      btn.appendChild(countSpan);

      btn.addEventListener('click', () => {
        // Remove active from all chips
        filterChips.querySelectorAll('.filter-chip').forEach(c => {
          c.classList.remove('active');
          c.style.background = 'transparent';
          c.style.color = '';
        });
        // Activate clicked chip
        btn.classList.add('active');
        btn.style.background = chip.color;
        btn.style.color = 'white';

        filterViolations(chip.key);

        // Update filter count text
        const shown = chip.key === 'all' ? counts.all : counts[chip.key];
        filterCount.textContent = 'Showing ' + shown + ' of ' + counts.all + ' violations';
      });

      filterChips.appendChild(btn);
    });

    filterCount.textContent = 'Showing ' + counts.all + ' of ' + counts.all + ' violations';
    filterBar.style.display = '';
  }

  function filterViolations(severityKey) {
    const cards = violationsList.querySelectorAll('.violation-card');
    cards.forEach(card => {
      if (severityKey === 'all') {
        card.style.display = '';
      } else {
        card.style.display = card.dataset.impact === severityKey ? '' : 'none';
      }
    });
  }

  // ── Crop and Show Screenshot ──
  function cropAndShowScreenshot(dataUrl, rect, cardEl) {
    const img = new Image();
    img.onload = () => {
      const dpr = rect.devicePixelRatio || 1;
      const padding = 16;

      const cropX = Math.max(0, rect.x * dpr - padding * dpr);
      const cropY = Math.max(0, rect.y * dpr - padding * dpr);
      const cropW = Math.min(img.width - cropX, (rect.width + padding * 2) * dpr);
      const cropH = Math.min(img.height - cropY, (rect.height + padding * 2) * dpr);

      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const croppedDataUrl = canvas.toDataURL('image/png');

      // Find or create screenshot container inside the card
      let container = cardEl.querySelector('.screenshot-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'screenshot-container';
        cardEl.appendChild(container);
      }

      container.innerHTML = `
        <div class="screenshot-wrapper">
          <div class="screenshot-label">📸 Element on page</div>
          <img src="${croppedDataUrl}" class="element-screenshot" alt="Screenshot of affected element">
          <div class="screenshot-note">Red outline = affected element</div>
        </div>
      `;

      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    img.src = dataUrl;
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

      // Save to scan history
      saveToHistory(window.lastScanResults);

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

  // ── Theme Toggle ──
  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    chrome.storage.local.set({ theme: newTheme });
    themeIcon.textContent = newTheme === 'dark' ? '\uD83C\uDF19' : '\u2600\uFE0F';
  });

  // ── History DOM References ──
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
  const historyList = document.getElementById('historyList');
  const historyHeaderClickArea = document.getElementById('historyHeaderClickArea');

  // ── History: grade helper ──
  function getGrade(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Needs Work';
    return 'Poor';
  }

  // ── History: relative time formatter ──
  function formatRelativeTime(isoString) {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diff = now - then;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';

    const d = new Date(isoString);
    const day = d.getDate();
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return day + ' ' + monthNames[d.getMonth()];
  }

  // ── History: save to storage ──
  function saveToHistory(scanResults) {
    if (!scanResults) return;
    chrome.storage.local.get({ scanHistory: [] }, (data) => {
      let history = data.scanHistory || [];

      let domain = '';
      try {
        domain = new URL(scanResults.url).hostname;
      } catch (e) {
        domain = scanResults.url || 'unknown';
      }

      const entry = {
        url: scanResults.url,
        domain: domain,
        score: scanResults.score,
        violations: Array.isArray(scanResults.violations) ? scanResults.violations.length : (scanResults.violations || 0),
        passes: typeof scanResults.passes === 'number' ? scanResults.passes : 0,
        timestamp: scanResults.timestamp || new Date().toISOString(),
        grade: getGrade(scanResults.score)
      };

      // Remove existing entry for the same domain
      history = history.filter(h => h.domain !== entry.domain);

      // Prepend new entry
      history.unshift(entry);

      // Keep only last 5
      history = history.slice(0, 5);

      chrome.storage.local.set({ scanHistory: history }, () => {
        loadAndRenderHistory();
      });
    });
  }

  // ── History: load and render ──
  function loadAndRenderHistory() {
    chrome.storage.local.get({ scanHistory: [] }, (data) => {
      renderHistory(data.scanHistory || []);
    });
  }

  // ── History: render ──
  function renderHistory(entries) {
    if (!historyList) return;
    historyList.innerHTML = '';

    if (!entries || entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'No scans yet. Scan a page to see history here.';
      historyList.appendChild(empty);
      return;
    }

    entries.forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'history-card';

      // Score badge
      const badge = document.createElement('div');
      badge.className = 'history-score-badge';
      badge.textContent = entry.score;
      badge.style.background = getScoreColor(entry.score);
      card.appendChild(badge);

      // Info
      const info = document.createElement('div');
      info.className = 'history-info';

      const domainEl = document.createElement('div');
      domainEl.className = 'history-domain';
      domainEl.textContent = entry.domain;
      domainEl.title = entry.url;
      info.appendChild(domainEl);

      const meta = document.createElement('div');
      meta.className = 'history-meta';
      const violationsSpan = document.createElement('span');
      violationsSpan.className = 'violations-text';
      violationsSpan.textContent = entry.violations + ' violation' + (entry.violations !== 1 ? 's' : '');
      meta.appendChild(violationsSpan);
      meta.appendChild(document.createTextNode(' · ' + formatRelativeTime(entry.timestamp)));
      info.appendChild(meta);

      card.appendChild(info);

      // Re-scan button
      const rescanBtn = document.createElement('button');
      rescanBtn.className = 'history-rescan';
      rescanBtn.textContent = 'Re-scan';
      rescanBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: entry.url });
      });
      card.appendChild(rescanBtn);

      historyList.appendChild(card);
    });
  }

  // ── History: toggle expand/collapse ──
  function toggleHistory() {
    if (!historyList || !toggleHistoryBtn) return;
    const isExpanded = historyList.classList.contains('expanded');
    historyList.classList.toggle('expanded', !isExpanded);
    toggleHistoryBtn.classList.toggle('expanded', !isExpanded);
  }

  // ── History: event listeners ──
  if (historyHeaderClickArea) {
    historyHeaderClickArea.addEventListener('click', (e) => {
      // Don't toggle if Clear button was clicked
      if (e.target === clearHistoryBtn) return;
      toggleHistory();
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.storage.local.remove('scanHistory', () => {
        renderHistory([]);
      });
    });
  }

  // ── Keyboard Shortcut Badge ──
  function showKeyboardTriggerBadge() {
    const badge = document.createElement('span');
    badge.className = 'keyboard-trigger-badge';
    badge.textContent = '⌨ Alt+Shift+A';
    const scanBtnParent = scanBtn.parentElement;
    scanBtnParent.insertBefore(badge, scanBtn);
    // Remove badge after animation completes
    setTimeout(() => {
      if (badge.parentElement) badge.parentElement.removeChild(badge);
    }, 2200);
  }

  // ── Init ──
  document.addEventListener('DOMContentLoaded', async () => {
    loadApiKey();
    loadAndRenderHistory();

    // Load saved theme
    chrome.storage.local.get('theme', (data) => {
      const savedTheme = data.theme || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      themeIcon.textContent = savedTheme === 'dark' ? '\uD83C\uDF19' : '\u2600\uFE0F';
    });

    // Check for keyboard shortcut auto-scan trigger
    const { autoScan, autoScanTabId } = await chrome.storage.local.get(['autoScan', 'autoScanTabId']);

    if (autoScan) {
      // Clear the flag immediately
      await chrome.storage.local.remove(['autoScan', 'autoScanTabId']);
      // Show a brief "Triggered by keyboard shortcut" label
      showKeyboardTriggerBadge();
      // Auto-click the scan button after a short delay for UX
      setTimeout(() => {
        document.getElementById('scanBtn').click();
      }, 300);
    }
  });

  // Also try loading immediately (DOMContentLoaded may have already fired)
  loadApiKey();

})();
