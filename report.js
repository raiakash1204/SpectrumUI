/**
 * report.js — PDF Report Generation for AccessUI Auditor
 * Uses jsPDF (loaded from CDN) to generate a detailed, client-side PDF accessibility report.
 */

window.generatePDFReport = function (scanResults) {
  'use strict';

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 18;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let totalPages = 0;
  const pageNumberPositions = []; // store callbacks for page numbers

  // ── Colors ──
  const COLORS = {
    darkBg: [15, 17, 23],
    surface: [26, 29, 38],
    purple: [129, 140, 248],
    white: [255, 255, 255],
    textMuted: [136, 145, 164],
    green: [6, 214, 160],
    yellow: [255, 209, 102],
    orange: [244, 162, 97],
    red: [230, 57, 70],
    codeBoxLight: [34, 37, 47],
    codeBoxDark: [24, 26, 33],
    border: [42, 45, 56],
  };

  // ── Helpers ──
  function setColor(c) { doc.setTextColor(c[0], c[1], c[2]); }
  function setFillColor(c) { doc.setFillColor(c[0], c[1], c[2]); }
  function setDrawColor(c) { doc.setDrawColor(c[0], c[1], c[2]); }

  function getScoreColor(score) {
    if (score >= 90) return COLORS.green;
    if (score >= 70) return COLORS.yellow;
    if (score >= 50) return COLORS.orange;
    return COLORS.red;
  }

  function getScoreGrade(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Needs Work';
    return 'Poor';
  }

  function getSeverityColor(severity) {
    const s = (severity || 'minor').toLowerCase();
    if (s === 'critical') return COLORS.red;
    if (s === 'serious') return COLORS.orange;
    if (s === 'moderate') return COLORS.yellow;
    return COLORS.textMuted;
  }

  function formatDate(isoString) {
    const d = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${mins}`;
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (_) {
      return 'unknown';
    }
  }

  function wrappedText(text, x, y, maxWidth, lineHeight) {
    const lines = doc.splitTextToSize(text, maxWidth);
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], x, y + i * lineHeight);
    }
    return y + lines.length * lineHeight;
  }

  function centeredText(text, y) {
    doc.text(text, PAGE_W / 2, y, { align: 'center' });
    return y;
  }

  function checkPageBreak(y, needed) {
    if (y + needed > PAGE_H - 25) {
      doc.addPage();
      totalPages++;
      fillPageBg();
      return MARGIN + 5;
    }
    return y;
  }

  function fillPageBg() {
    setFillColor(COLORS.darkBg);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  }

  function drawRoundedRect(x, y, w, h, r, style) {
    doc.roundedRect(x, y, w, h, r, r, style);
  }

  // ── Extract data ──
  const url = scanResults.url || 'Unknown URL';
  const score = typeof scanResults.score === 'number' ? scanResults.score : 0;
  const violations = scanResults.violations || [];
  const passes = typeof scanResults.passes === 'number' ? scanResults.passes
    : (scanResults.summary ? scanResults.summary.passes : 0);
  const incomplete = typeof scanResults.incomplete === 'number' ? scanResults.incomplete
    : (scanResults.summary ? scanResults.summary.incomplete : 0);
  const timestamp = scanResults.timestamp || new Date().toISOString();
  const explanations = scanResults.explanations || [];

  // Build explanation map
  const explanationMap = {};
  if (Array.isArray(explanations)) {
    for (const exp of explanations) {
      explanationMap[exp.id] = exp;
    }
  }

  // Sort violations by severity
  const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const sortedViolations = [...violations].sort((a, b) => {
    return (impactOrder[(a.impact || 'minor').toLowerCase()] || 3) -
      (impactOrder[(b.impact || 'minor').toLowerCase()] || 3);
  });

  // Count severities
  const severityCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) {
    const imp = (v.impact || 'minor').toLowerCase();
    severityCounts[imp] = (severityCounts[imp] || 0) + 1;
  }

  // ════════════════════════════════════════
  // PAGE 1 — COVER PAGE
  // ════════════════════════════════════════
  totalPages = 1;
  fillPageBg();

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  setColor(COLORS.white);
  centeredText('AccessUI Auditor', 48);

  // Subtitle
  doc.setFontSize(14);
  setColor(COLORS.purple);
  doc.setFont('helvetica', 'normal');
  centeredText('Accessibility Audit Report', 60);

  // URL box
  doc.setFontSize(10);
  const urlText = url.length > 70 ? url.substring(0, 67) + '...' : url;
  const urlBoxW = Math.min(CONTENT_W, doc.getTextWidth(urlText) + 20);
  const urlBoxX = (PAGE_W - urlBoxW) / 2;
  setFillColor(COLORS.surface);
  setDrawColor(COLORS.border);
  drawRoundedRect(urlBoxX, 68, urlBoxW, 10, 3, 'FD');
  setColor(COLORS.textMuted);
  centeredText(urlText, 74.5);

  // Date
  doc.setFontSize(10);
  setColor(COLORS.textMuted);
  centeredText('Generated on: ' + formatDate(timestamp), 88);

  // Score circle
  const scoreColor = getScoreColor(score);
  const circleCX = PAGE_W / 2;
  const circleCY = 125;
  const circleR = 26;
  setFillColor(scoreColor);
  doc.circle(circleCX, circleCY, circleR, 'F');

  // Score number inside circle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  setColor(COLORS.white);
  centeredText(String(score), circleCY + 4);

  // Grade below circle
  doc.setFontSize(13);
  const gradeColor = scoreColor;
  setColor(gradeColor);
  doc.setFont('helvetica', 'bold');
  centeredText(getScoreGrade(score), circleCY + circleR + 12);

  // Summary stats row — 3 boxes
  const boxY = 178;
  const boxH = 28;
  const boxGap = 6;
  const boxW = (CONTENT_W - boxGap * 2) / 3;
  const statsData = [
    { label: 'Violations', count: violations.length, tint: COLORS.red },
    { label: 'Passes', count: passes, tint: COLORS.green },
    { label: 'Incomplete', count: incomplete, tint: COLORS.yellow },
  ];

  statsData.forEach((stat, i) => {
    const bx = MARGIN + i * (boxW + boxGap);
    // Box background with tint
    setFillColor([stat.tint[0], stat.tint[1], stat.tint[2]]);
    doc.setGState(new doc.GState({ opacity: 0.12 }));
    drawRoundedRect(bx, boxY, boxW, boxH, 3, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));

    // Border
    setDrawColor(stat.tint);
    doc.setLineWidth(0.4);
    drawRoundedRect(bx, boxY, boxW, boxH, 3, 'D');

    // Count
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    setColor(stat.tint);
    doc.text(String(stat.count), bx + boxW / 2, boxY + 12, { align: 'center' });

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(COLORS.textMuted);
    doc.text(stat.label.toUpperCase(), bx + boxW / 2, boxY + 21, { align: 'center' });
  });

  // Footer
  doc.setFontSize(9);
  setColor(COLORS.textMuted);
  doc.setFont('helvetica', 'italic');
  centeredText('Powered by AccessUI Auditor + Gemini AI', PAGE_H - 20);

  // ════════════════════════════════════════
  // PAGE 2 — EXECUTIVE SUMMARY
  // ════════════════════════════════════════
  doc.addPage();
  totalPages++;
  fillPageBg();

  let y = MARGIN + 5;

  // Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setColor(COLORS.purple);
  doc.text('Executive Summary', MARGIN, y);
  y += 12;

  // Dynamic paragraph
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(COLORS.white);

  const summaryText = `This report presents the results of an automated accessibility audit conducted on ${url} on ${formatDate(timestamp)}. The page received an accessibility score of ${score}/100. A total of ${violations.length} violation${violations.length !== 1 ? 's were' : ' was'} detected. Addressing critical and serious issues first is recommended to maximize impact for users with disabilities.`;

  y = wrappedText(summaryText, MARGIN, y, CONTENT_W, 5.5);
  y += 10;

  // Severity breakdown table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(COLORS.purple);
  doc.text('Severity Breakdown', MARGIN, y);
  y += 8;

  // Table header
  const colX = [MARGIN + 4, MARGIN + 33, MARGIN + 50, MARGIN + 130];
  setFillColor(COLORS.surface);
  doc.rect(MARGIN, y - 4, CONTENT_W, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(COLORS.textMuted);
  doc.text('SEVERITY', colX[0], y);
  doc.text('COUNT', colX[1], y);
  doc.text('IMPACT DESCRIPTION', colX[2], y);
  doc.text('PRIORITY', colX[3], y);
  y += 7;

  const severityRows = [
    {
      name: 'Critical', count: severityCounts.critical,
      desc: 'Blocks access entirely for affected users',
      priority: 'Immediate', color: COLORS.red,
    },
    {
      name: 'Serious', count: severityCounts.serious,
      desc: 'Creates significant barriers to access',
      priority: 'High', color: COLORS.orange,
    },
    {
      name: 'Moderate', count: severityCounts.moderate,
      desc: 'Causes confusion or difficulty for some users',
      priority: 'Medium', color: COLORS.yellow,
    },
    {
      name: 'Minor', count: severityCounts.minor,
      desc: 'Minor inconvenience, best practice violation',
      priority: 'Low', color: COLORS.textMuted,
    },
  ];

  severityRows.forEach((row) => {
    // Color-coded left border
    setFillColor(row.color);
    doc.rect(MARGIN, y - 4, 2, 9, 'F');

    // Row background
    setFillColor(COLORS.surface);
    doc.setGState(new doc.GState({ opacity: 0.4 }));
    doc.rect(MARGIN + 2, y - 4, CONTENT_W - 2, 9, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setColor(row.color);
    doc.text(row.name, colX[0], y);

    setColor(COLORS.white);
    doc.setFont('helvetica', 'normal');
    doc.text(String(row.count), colX[1], y);

    doc.setFontSize(8);
    setColor(COLORS.textMuted);
    doc.text(row.desc, colX[2], y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setColor(row.color);
    doc.text(row.priority, colX[3], y);

    y += 11;
  });

  y += 5;

  // WCAG note
  setFillColor(COLORS.surface);
  drawRoundedRect(MARGIN, y, CONTENT_W, 10, 3, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  setColor(COLORS.textMuted);
  doc.text('This audit checks against WCAG 2.1 Level AA guidelines.', MARGIN + 5, y + 6.5);

  // ════════════════════════════════════════
  // PAGES 3+ — VIOLATION DETAILS
  // ════════════════════════════════════════
  if (sortedViolations.length > 0) {
    doc.addPage();
    totalPages++;
    fillPageBg();

    y = MARGIN + 5;

    // Section heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    setColor(COLORS.purple);
    doc.text('Violation Details', MARGIN, y);
    y += 12;

    sortedViolations.forEach((violation, idx) => {
      const explanation = explanationMap[violation.id] || null;
      const severity = explanation ? explanation.severity
        : ((violation.impact || 'minor').charAt(0).toUpperCase() + (violation.impact || 'minor').slice(1));
      const sevColor = getSeverityColor(severity);
      const description = explanation ? explanation.plainEnglish
        : (violation.description || violation.help || 'Accessibility issue detected.');
      const whoAffected = explanation ? explanation.whoIsAffected : '';
      const codefix = explanation ? explanation.codefix : '';
      const brokenHtml = violation.nodes && violation.nodes.length > 0
        ? (violation.nodes[0].html || '') : '';

      // Estimate block height
      const descLines = doc.splitTextToSize(description, CONTENT_W - 10).length;
      let estimatedH = 30 + descLines * 5;
      if (whoAffected) estimatedH += 8;
      if (brokenHtml) estimatedH += 25;
      if (codefix) estimatedH += 25;

      y = checkPageBreak(y, Math.min(estimatedH, 100));

      // Violation badge
      const badgeLabel = 'VIOLATION ' + String(idx + 1).padStart(2, '0');
      setFillColor(sevColor);
      const badgeLabelW = doc.setFont('helvetica', 'bold').setFontSize(8).getTextWidth(badgeLabel) + 8;
      drawRoundedRect(MARGIN, y, badgeLabelW, 6.5, 2, 'F');
      setColor(COLORS.white);
      doc.text(badgeLabel, MARGIN + 4, y + 4.7);

      // Rule ID in monospace
      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
      setColor(COLORS.textMuted);
      doc.text(violation.id, MARGIN + badgeLabelW + 4, y + 4.7);

      // Severity badge inline
      const sevBadgeX = MARGIN + badgeLabelW + 4 + doc.getTextWidth(violation.id) + 4;
      setFillColor(sevColor);
      doc.setGState(new doc.GState({ opacity: 0.2 }));
      const sevBadgeLabelW = doc.setFont('helvetica', 'bold').setFontSize(7).getTextWidth(severity.toUpperCase()) + 6;
      drawRoundedRect(sevBadgeX, y + 0.5, sevBadgeLabelW, 5.5, 2, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
      setColor(sevColor);
      doc.text(severity.toUpperCase(), sevBadgeX + 3, y + 4.5);

      y += 11;

      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setColor(COLORS.white);
      y = wrappedText(description, MARGIN + 2, y, CONTENT_W - 4, 5);
      y += 4;

      // Who is affected
      if (whoAffected) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        setColor(COLORS.textMuted);
        y = wrappedText('Who is affected: ' + whoAffected, MARGIN + 2, y, CONTENT_W - 4, 4.5);
        y += 5;
      }

      // Broken HTML code box
      if (brokenHtml) {
        y = checkPageBreak(y, 20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        setColor(COLORS.textMuted);
        doc.text('BROKEN HTML', MARGIN + 2, y);
        y += 4;

        const htmlLines = doc.setFont('courier', 'normal').setFontSize(7.5)
          .splitTextToSize(brokenHtml, CONTENT_W - 14);
        const codeBoxH = Math.min(htmlLines.length * 4.2 + 6, 35);

        setFillColor(COLORS.codeBoxLight);
        drawRoundedRect(MARGIN, y, CONTENT_W, codeBoxH, 2, 'F');

        setColor([200, 210, 230]);
        let codeY = y + 5;
        for (let i = 0; i < htmlLines.length && codeY < y + codeBoxH - 2; i++) {
          doc.text(htmlLines[i], MARGIN + 4, codeY);
          codeY += 4.2;
        }

        y += codeBoxH + 4;
      }

      // Suggested code fix
      if (codefix) {
        y = checkPageBreak(y, 20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        setColor(COLORS.green);
        doc.text('SUGGESTED FIX', MARGIN + 2, y);
        y += 4;

        const fixLines = doc.setFont('courier', 'normal').setFontSize(7.5)
          .splitTextToSize(codefix, CONTENT_W - 14);
        const fixBoxH = Math.min(fixLines.length * 4.2 + 6, 40);

        setFillColor(COLORS.codeBoxDark);
        drawRoundedRect(MARGIN, y, CONTENT_W, fixBoxH, 2, 'F');

        setColor([180, 230, 200]);
        let fixCodeY = y + 5;
        for (let i = 0; i < fixLines.length && fixCodeY < y + fixBoxH - 2; i++) {
          doc.text(fixLines[i], MARGIN + 4, fixCodeY);
          fixCodeY += 4.2;
        }

        y += fixBoxH + 4;
      }

      // Horizontal divider
      if (idx < sortedViolations.length - 1) {
        y += 2;
        setDrawColor(COLORS.border);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, y, PAGE_W - MARGIN, y);
        y += 6;
      }
    });
  }

  // ════════════════════════════════════════
  // LAST PAGE — RECOMMENDATIONS
  // ════════════════════════════════════════
  doc.addPage();
  totalPages++;
  fillPageBg();

  y = MARGIN + 5;

  // Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setColor(COLORS.purple);
  doc.text('Recommendations', MARGIN, y);
  y += 12;

  // Top 5 violations by severity
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(COLORS.white);
  doc.text('Top Recommendations', MARGIN, y);
  y += 8;

  const top5 = sortedViolations.slice(0, 5);
  if (top5.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setColor(COLORS.green);
    doc.text('No violations detected — great job!', MARGIN + 4, y);
    y += 10;
  } else {
    top5.forEach((v, i) => {
      const explanation = explanationMap[v.id] || null;
      const sev = explanation ? explanation.severity
        : ((v.impact || 'minor').charAt(0).toUpperCase() + (v.impact || 'minor').slice(1));
      const sevColor = getSeverityColor(sev);
      const desc = explanation ? explanation.plainEnglish
        : (v.description || v.help || 'Accessibility issue detected.');

      // Number
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setColor(sevColor);
      doc.text(`${i + 1}.`, MARGIN + 2, y);

      // Severity badge
      const sevBW = doc.setFontSize(7).getTextWidth(sev.toUpperCase()) + 6;
      setFillColor(sevColor);
      doc.setGState(new doc.GState({ opacity: 0.2 }));
      drawRoundedRect(MARGIN + 10, y - 3.5, sevBW, 5.5, 2, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
      setColor(sevColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(sev.toUpperCase(), MARGIN + 13, y);

      // Rule id
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      setColor(COLORS.textMuted);
      doc.text(v.id, MARGIN + 13 + sevBW + 3, y);
      y += 5;

      // Short description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setColor(COLORS.white);
      const descTrimmed = desc.length > 120 ? desc.substring(0, 117) + '...' : desc;
      y = wrappedText(descTrimmed, MARGIN + 10, y, CONTENT_W - 12, 4.5);
      y += 5;
    });
  }

  y += 8;

  // Next Steps
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(COLORS.white);
  doc.text('Next Steps', MARGIN, y);
  y += 8;

  const nextSteps = [
    'Fix all Critical violations immediately.',
    'Re-run this audit after fixes.',
    'Test with a real screen reader (NVDA, VoiceOver).',
    'Share this report with your development team.',
  ];

  nextSteps.forEach((step, i) => {
    setFillColor(COLORS.surface);
    drawRoundedRect(MARGIN, y - 3.5, CONTENT_W, 8, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(COLORS.purple);
    doc.text(`${i + 1}.`, MARGIN + 4, y + 1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setColor(COLORS.white);
    doc.text(step, MARGIN + 14, y + 1);
    y += 11;
  });

  y += 10;

  // Footer line
  setDrawColor(COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  setColor(COLORS.textMuted);
  centeredText('Powered by AccessUI Auditor + Gemini AI', y);

  // ════════════════════════════════════════
  // PAGE NUMBERS — "Page X of Y" on every page
  // ════════════════════════════════════════
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(COLORS.textMuted);
    doc.text(`Page ${p} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 10, { align: 'right' });
  }

  // ════════════════════════════════════════
  // SAVE / DOWNLOAD
  // ════════════════════════════════════════
  const domain = getDomain(url);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `accessui-report-${domain}-${dateStr}.pdf`;
  doc.save(filename);
};
