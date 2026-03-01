/**
 * sidepanel.js — Main logic for SpectrumUI side panel
 * Based on popup.js with added tab tracking and auto re-scan.
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
  const currentPageTitle = document.getElementById('currentPageTitle');
  const currentPageFavicon = document.getElementById('currentPageFavicon');
  const autoRescanToggle = document.getElementById('autoRescanToggle');
  const sortSelect = document.getElementById('sortSelect');
  const scoreGrade = document.getElementById('scoreGrade');

  // ── State ──
  let lastResults = null;
  let currentApiKey = '';
  let autoRescanEnabled = false;
  let autoScanTimer = null;
  window.selectedFramework = 'html';
  window.currentViolations = [];
  window.currentSeverityFilter = 'all';

  // ── Framework name map ──
  const frameworkDisplayNames = {
    'react': 'React (JSX)',
    'vue': 'Vue.js (SFC templates)',
    'angular': 'Angular (TypeScript templates)',
    'svelte': 'Svelte',
    'nextjs': 'Next.js (React/JSX)',
    'html': 'Plain HTML5'
  };

  // ── Framework Selector ──
  function setSelectedFramework(framework) {
    window.selectedFramework = framework;
    document.querySelectorAll('.framework-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.framework === framework);
    });
    chrome.storage.local.set({ selectedFramework: framework });
  }

  document.querySelectorAll('.framework-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setSelectedFramework(btn.dataset.framework);
      const badge = document.getElementById('frameworkAutoDetected');
      if (badge) badge.style.display = 'none';
    });
  });

  // ── Colour Blindness Simulator ──
  document.querySelectorAll('.cb-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.type;
      document.querySelectorAll('.cb-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (type === 'normal') {
        await window.ColorBlindSim.remove();
        document.getElementById('cbActiveLabel').style.display = 'none';
      } else {
        await window.ColorBlindSim.apply(type);
        document.getElementById('cbActiveName').textContent = btn.querySelector('.cb-label').textContent;
        document.getElementById('cbActiveLabel').style.display = 'flex';
      }
    });
  });

  document.getElementById('cbResetBtn').addEventListener('click', () => {
    window.ColorBlindSim.remove();
    document.querySelectorAll('.cb-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.cb-btn[data-type="normal"]').classList.add('active');
    document.getElementById('cbActiveLabel').style.display = 'none';
  });

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

  function calculatePriority(violation) {
    const severityKey = (violation.impact || 'minor').toLowerCase();
    const severityMap = { critical: 40, serious: 30, moderate: 15, minor: 5 };
    const severityPoints = severityMap[severityKey] || 5;

    const elements = Math.max(1, (violation.nodes && violation.nodes.length) ? violation.nodes.length : 0);
    let elementCountPoints = 5;
    if (elements >= 21) elementCountPoints = 45;
    else if (elements >= 11) elementCountPoints = 35;
    else if (elements >= 6) elementCountPoints = 25;
    else if (elements >= 2) elementCountPoints = 15;

    const easyRules = new Set([
      'image-alt', 'input-image-alt', 'area-alt',
      'html-has-lang', 'html-lang-valid',
      'document-title', 'meta-viewport',
      'link-name', 'button-name'
    ]);
    const mediumRules = new Set([
      'label', 'select-name', 'form-field-multiple-labels',
      'frame-title', 'iframe-title', 'object-alt'
    ]);
    const hardRules = new Set([
      'color-contrast', 'heading-order',
      'landmark-one-main', 'region',
      'aria-hidden-focus', 'focus-order-semantics',
      'tabindex', 'scrollable-region-focusable'
    ]);

    let fixComplexity = 'Medium';
    let fixComplexityPoints = 8;
    if (easyRules.has(violation.id)) {
      fixComplexity = 'Easy';
      fixComplexityPoints = 20;
    } else if (mediumRules.has(violation.id)) {
      fixComplexity = 'Medium';
      fixComplexityPoints = 10;
    } else if (hardRules.has(violation.id)) {
      fixComplexity = 'Hard';
      fixComplexityPoints = 3;
    }

    const tags = Array.isArray(violation.tags) ? violation.tags : [];
    let userImpact = 5;
    if (tags.includes('wcag2a')) userImpact = 15;
    else if (tags.includes('wcag2aa')) userImpact = 10;
    else if (tags.includes('best-practice')) userImpact = 3;

    const score = severityPoints + elementCountPoints + fixComplexityPoints + userImpact;

    let tier = 'Low';
    let tierEmoji = '🔵';
    let tierColor = '#3060b0';
    if (score >= 80) {
      tier = 'Fix First';
      tierEmoji = '🔥';
      tierColor = '#c84030';
    } else if (score >= 50) {
      tier = 'High';
      tierEmoji = '⚡';
      tierColor = '#c87820';
    } else if (score >= 25) {
      tier = 'Medium';
      tierEmoji = '📋';
      tierColor = '#a09030';
    }

    return {
      score,
      tier,
      tierEmoji,
      tierColor,
      factors: {
        severity: severityPoints,
        elementCount: elementCountPoints,
        fixComplexity,
        fixComplexityPoints,
        userImpact
      }
    };
  }

  function sortViolationsByPriority(violations) {
    return [...violations]
      .map(v => ({ ...v, priority: calculatePriority(v) }))
      .sort((a, b) => b.priority.score - a.priority.score);
  }

  function applyCurrentSort() {
    const sortMode = sortSelect ? sortSelect.value : 'priority';
    const severityRank = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    const complexityRank = { Easy: 0, Medium: 1, Hard: 2 };

    window.currentViolations.sort((a, b) => {
      if (sortMode === 'severity') {
        return (severityRank[(a.impact || 'minor').toLowerCase()] || 3) -
          (severityRank[(b.impact || 'minor').toLowerCase()] || 3);
      }
      if (sortMode === 'elements') {
        return ((b.nodes && b.nodes.length) || 0) - ((a.nodes && a.nodes.length) || 0);
      }
      if (sortMode === 'complexity-asc') {
        const c = (complexityRank[a.priority.factors.fixComplexity] || 1) -
          (complexityRank[b.priority.factors.fixComplexity] || 1);
        return c !== 0 ? c : (b.priority.score - a.priority.score);
      }
      return b.priority.score - a.priority.score;
    });
  }

  function buildPrioritySummary(violations) {
    const summary = { fixFirst: 0, high: 0, medium: 0, low: 0, quickWins: 0 };

    violations.forEach(v => {
      const p = v.priority || calculatePriority(v);
      if (p.tier === 'Fix First') summary.fixFirst++;
      else if (p.tier === 'High') summary.high++;
      else if (p.tier === 'Medium') summary.medium++;
      else summary.low++;

      const sev = (v.impact || 'minor').toLowerCase();
      if (p.factors.fixComplexity === 'Easy' && (sev === 'critical' || sev === 'serious')) {
        summary.quickWins++;
      }
    });

    const bar = document.getElementById('prioritySummary');
    if (!bar) return;

    document.getElementById('psFixFirst').textContent = summary.fixFirst + ' Fix First';
    document.getElementById('psHigh').textContent = summary.high + ' High';
    document.getElementById('psMedium').textContent = summary.medium + ' Medium';
    document.getElementById('psLow').textContent = summary.low + ' Low';
    document.getElementById('psQuickWins').textContent = summary.quickWins + ' quick wins available';
    bar.style.display = violations.length ? '' : 'none';
  }

  function renderCurrentViolationsList(explanationMap) {
    violationsList.innerHTML = '';

    if (window.currentViolations.length === 0) {
      const noVio = document.createElement('div');
      noVio.className = 'no-violations';
      noVio.innerHTML = `
        <div class="no-violations-icon">🎉</div>
        <div class="no-violations-text">No violations found!</div>
        <div class="no-violations-sub">This page passed all automated accessibility checks.</div>
      `;
      violationsList.appendChild(noVio);
      return;
    }

    window.currentViolations.forEach((violation, idx) => {
      const explanation = explanationMap[violation.id] || null;
      const card = buildViolationCard(violation, explanation, idx);
      violationsList.appendChild(card);
    });

    filterViolations(window.currentSeverityFilter || 'all');
  }

  // ── Score Color ──
  function getScoreColor(score) {
    if (score >= 90) return '#40907a';
    if (score >= 70) return '#a09030';
    if (score >= 50) return '#c87820';
    return '#c84030';
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
    const circumference = scoreRingFill.getTotalLength();
    const color = getScoreColor(targetScore);

    scoreRingFill.style.stroke = color;
    scoreRingFill.setAttribute('stroke-dasharray', circumference);

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

    // Update score grade label
    if (scoreGrade) {
      let grade = 'Poor';
      if (targetScore >= 90) grade = 'Excellent';
      else if (targetScore >= 70) grade = 'Good';
      else if (targetScore >= 50) grade = 'Needs Work';
      scoreGrade.textContent = grade;
      scoreGrade.style.color = color;
    }

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

    if (index === 0) {
      card.classList.add('top-priority-card');
    }

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

    if (index === 0) {
      const startHereLabel = document.createElement('div');
      startHereLabel.className = 'start-here-label';
      startHereLabel.textContent = 'START HERE';
      header.appendChild(startHereLabel);
    }

    const priority = violation.priority || calculatePriority(violation);
    const priorityBadge = document.createElement('div');
    priorityBadge.className = 'priority-badge';
    priorityBadge.style.background = priority.tierColor + '20';
    priorityBadge.style.border = '1px solid ' + priority.tierColor + '40';
    priorityBadge.style.color = priority.tierColor;
    const elementCount = (violation.nodes && violation.nodes.length) ? violation.nodes.length : 0;
    priorityBadge.textContent = `${priority.tierEmoji} ${priority.tier} · Priority ${priority.score}/120`;
    priorityBadge.dataset.tooltip = `Severity: +${priority.factors.severity} | Elements affected: ${elementCount} (+${priority.factors.elementCount}) | Fix complexity: ${priority.factors.fixComplexity} (+${priority.factors.fixComplexityPoints}) | User impact: +${priority.factors.userImpact}`;
    header.appendChild(priorityBadge);

    // Top row: severity + id
    const topRow = document.createElement('div');
    topRow.className = 'violation-card-top';
    topRow.appendChild(createSeverityBadge(severity));

    const idSpan = document.createElement('span');
    idSpan.className = 'violation-id';
    idSpan.textContent = violation.id;
    topRow.appendChild(idSpan);

    const impactKey = (violation.impact || 'minor').toLowerCase();
    if (priority.factors.fixComplexity === 'Easy' && (impactKey === 'critical' || impactKey === 'serious')) {
      const quickWinBadge = document.createElement('span');
      quickWinBadge.className = 'quick-win-badge';
      quickWinBadge.textContent = '✓ Quick Win';
      topRow.appendChild(quickWinBadge);
    }

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
    window.currentSeverityFilter = 'all';
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

    const explanationMap = {};
    if (explanations) {
      for (const exp of explanations) {
        explanationMap[exp.id] = exp;
      }
    }

    window.currentViolations = [...scanData.violations];
    applyCurrentSort();
    renderCurrentViolationsList(explanationMap);

    showResults();

    // Build severity filter bar
    if (scanData.violations.length > 0) {
      buildFilterBar(scanData.violations);
      buildPrioritySummary(scanData.violations);
      const sortRow = document.querySelector('.sort-row');
      if (sortRow) sortRow.style.display = '';
    } else {
      const bar = document.getElementById('prioritySummary');
      if (bar) bar.style.display = 'none';
      const sortRow = document.querySelector('.sort-row');
      if (sortRow) sortRow.style.display = 'none';
    }
  }

  // ── Severity Filter Bar ──
  function buildFilterBar(violations) {
    const counts = { all: violations.length, critical: 0, serious: 0, moderate: 0, minor: 0 };
    violations.forEach(v => { if (counts[v.impact] !== undefined) counts[v.impact]++; });

    const chips = [
      { label: 'All',      key: 'all',      color: '#706050' },
      { label: 'Critical', key: 'critical',  color: '#c84030' },
      { label: 'Serious',  key: 'serious',   color: '#c87820' },
      { label: 'Moderate', key: 'moderate',  color: '#a09030' },
      { label: 'Minor',    key: 'minor',     color: '#3060b0' },
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

        window.currentSeverityFilter = chip.key;
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

  // ── Update Current Page Indicator ──
  function updatePageIndicator(tab) {
    if (!tab) return;
    currentPageTitle.textContent = tab.title || tab.url || 'Unknown page';
    currentPageFavicon.innerHTML = '';
    if (tab.favIconUrl) {
      const img = document.createElement('img');
      img.src = tab.favIconUrl;
      img.width = 14;
      img.height = 14;
      img.alt = '';
      currentPageFavicon.appendChild(img);
    }
  }

  // ── Auto Re-scan ──
  function triggerAutoScan() {
    if (autoScanTimer) clearTimeout(autoScanTimer);
    autoScanTimer = setTimeout(() => {
      autoScanTimer = null;
      runScan();
    }, 500);
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

    // Update page indicator on scan
    updatePageIndicator(tab);

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
          explanations = await explainViolations(scanData.violations, apiKey, window.selectedFramework || 'html');
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

      const prioritizedViolations = sortViolationsByPriority(scanData.violations);
      scanData.violations = prioritizedViolations;
      lastResults.violations = prioritizedViolations;

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

      // Show framework used label
      if (aiAvailable) {
        let fwLabel = document.getElementById('frameworkUsedLabel');
        if (!fwLabel) {
          fwLabel = document.createElement('div');
          fwLabel.id = 'frameworkUsedLabel';
          fwLabel.className = 'framework-used-label';
          violationsList.parentNode.insertBefore(fwLabel, violationsList);
        }
        const fwDisplay = frameworkDisplayNames[window.selectedFramework || 'html'] || 'Plain HTML5';
        fwLabel.textContent = 'Fixes generated for: ' + fwDisplay;
        fwLabel.style.display = '';
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
    a.download = 'spectrumui-report.json';
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

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      if (!window.currentViolations || window.currentViolations.length === 0) return;
      const explanationMap = {};
      if (lastResults && Array.isArray(lastResults.explanations)) {
        lastResults.explanations.forEach(exp => { explanationMap[exp.id] = exp; });
      }
      applyCurrentSort();
      renderCurrentViolationsList(explanationMap);
    });
  }

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
    themeIcon.textContent = newTheme === 'dark' ? '\u25D0' : '\u25D1';
  });

  // ── Auto Re-scan Toggle ──
  autoRescanToggle.addEventListener('change', (e) => {
    autoRescanEnabled = e.target.checked;
    chrome.storage.local.set({ autoRescan: autoRescanEnabled });
  });

  // ── Tab Navigation Listeners (side panel specific) ──
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
      const tab = await chrome.tabs.get(tabId);
      updatePageIndicator(tab);
      // Remove colour blindness filter when switching tabs
      if (window.ColorBlindSim) {
        window.ColorBlindSim.remove();
        document.querySelectorAll('.cb-btn').forEach(b => b.classList.remove('active'));
        const normalBtn = document.querySelector('.cb-btn[data-type="normal"]');
        if (normalBtn) normalBtn.classList.add('active');
        const lbl = document.getElementById('cbActiveLabel');
        if (lbl) lbl.style.display = 'none';
      }
      if (autoRescanEnabled) triggerAutoScan();
    } catch (err) {
      console.warn('Could not get tab info:', err);
    }
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabId === activeTab.id) {
          updatePageIndicator(tab);
          if (autoRescanEnabled) triggerAutoScan();
        }
      } catch (err) {
        console.warn('Could not check active tab:', err);
      }
    }
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
      themeIcon.textContent = savedTheme === 'dark' ? '\u25D0' : '\u25D1';
    });

    // Restore auto-rescan preference
    const { autoRescan } = await chrome.storage.local.get('autoRescan');
    if (autoRescan) {
      autoRescanEnabled = true;
      autoRescanToggle.checked = true;
    }

    // Load saved framework preference
    const { selectedFramework: savedFw } = await chrome.storage.local.get('selectedFramework');
    if (savedFw) {
      setSelectedFramework(savedFw);
    }

    // Auto-detect framework from the current page
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        const result = await chrome.tabs.sendMessage(tab.id, { action: 'detectFramework' });
        if (result && result.framework && result.framework !== 'html') {
          setSelectedFramework(result.framework);
          const badge = document.getElementById('frameworkAutoDetected');
          if (badge) badge.style.display = 'inline';
        }
      }
    } catch (err) {
      console.warn('Framework auto-detection failed:', err);
    }

    // Restore last colour blindness selection (pre-select button, don't auto-apply)
    try {
      const { lastColorSim } = await chrome.storage.local.get('lastColorSim');
      if (lastColorSim && lastColorSim !== 'normal') {
        const btn = document.querySelector('.cb-btn[data-type="' + lastColorSim + '"]');
        if (btn) {
          document.querySelectorAll('.cb-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      }
    } catch (err) {
      console.warn('Could not restore colour sim preference:', err);
    }

    // Populate current page indicator
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        updatePageIndicator(tab);
      }
    } catch (err) {
      console.warn('Could not get active tab on init:', err);
    }

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
