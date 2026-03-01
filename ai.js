/**
 * ai.js — Gemini AI integration for AccessUI Auditor
 * Sends axe-core violations to Gemini and returns plain-English explanations with code fixes.
 */

/**
 * Call the Gemini API for a single batch of (already-trimmed) violations.
 * Returns the parsed array on success or throws on failure.
 */
async function _callGemini(trimmedBatch, apiKey) {
  const prompt = `You are a web accessibility expert. Analyse the following axe-core violations and for each one return a JSON object. Return ONLY a valid JSON array with no markdown, no code fences, no explanation outside the array. Each object must have exactly these fields:
- id (string): the axe rule id
- plainEnglish (string): a clear, friendly explanation of the issue in 1–2 sentences
- whoIsAffected (string): which group of users this impacts (e.g. 'screen reader users', 'keyboard-only users', 'users with low vision')
- codefix (string): a short, specific code snippet showing the corrected HTML or CSS
- severity (string): one of 'Critical', 'Serious', 'Moderate', or 'Minor'

Violations data: ${JSON.stringify(trimmedBatch)}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
      })
    }
  );

  // ── Check HTTP status ──
  if (!response.ok) {
    let errBody;
    try { errBody = await response.json(); } catch (_) { errBody = await response.text(); }
    console.error('Gemini API error:', response.status, errBody);
    throw new Error(
      (errBody && errBody.error && errBody.error.message)
        ? errBody.error.message
        : `API request failed with status ${response.status}`
    );
  }

  const data = await response.json();
  const rawText = data.candidates[0].content.parts[0].text;

  // ── Aggressive JSON extraction ──
  const clean = rawText
    .replace(/^[\s\S]*?(\[)/, '[')   // strip everything before the first [
    .replace(/\][\s\S]*$/, ']')       // strip everything after the last ]
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (parseErr) {
    console.error('Gemini parse error:', parseErr);
    console.error('Raw response was:', rawText);
    throw parseErr;
  }

  if (!Array.isArray(parsed)) {
    console.error('Gemini response is not an array. Raw:', rawText);
    throw new Error('Response is not an array');
  }

  return parsed;
}

async function explainViolations(violations, apiKey) {
  if (!violations || violations.length === 0) {
    return [];
  }

  if (!apiKey) {
    console.error('explainViolations called without an API key');
    throw new Error('Missing Gemini API key');
  }

  // ── Trim violations to essential fields & cap HTML length ──
  const trimmed = violations.map(v => ({
    id: v.id,
    description: v.description,
    impact: v.impact,
    html: (v.nodes && v.nodes[0] && v.nodes[0].html || '').substring(0, 300)
  }));

  let lastError = null;
  let rawTextForDebug = '';

  // ── Attempt 1: single bulk call ──
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await _callGemini(trimmed, apiKey);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`Gemini bulk call attempt ${attempt} failed:`, err.message);
      if (attempt < 2) {
        // Wait before retry
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  // ── Attempt 3: split into batches of 3 and merge results ──
  console.warn('Bulk calls failed, retrying in batches of 3...');
  try {
    const batchSize = 3;
    const allResults = [];
    for (let i = 0; i < trimmed.length; i += batchSize) {
      const batch = trimmed.slice(i, i + batchSize);
      // Small delay between batches to respect rate limits
      if (i > 0) {
        await new Promise(r => setTimeout(r, 1500));
      }
      const batchResult = await _callGemini(batch, apiKey);
      allResults.push(...batchResult);
    }
    return allResults;
  } catch (batchErr) {
    console.error('Batch call also failed:', batchErr);
    lastError = batchErr;
  }

  // ── Final fallback ──
  console.error('All Gemini attempts failed. Returning fallback explanations.');
  console.error('Last error was:', lastError);

  const severityMap = { critical: 'Critical', serious: 'Serious', moderate: 'Moderate', minor: 'Minor' };
  return violations.map(v => ({
    id: v.id,
    plainEnglish: v.description || v.help || 'Accessibility violation detected.',
    whoIsAffected: 'Users with disabilities may be affected.',
    codefix: `AI explanation unavailable — check console for details. Rule: ${v.id}. Refer to: https://dequeuniversity.com/rules/axe/4.9/${v.id}`,
    severity: severityMap[(v.impact || 'minor').toLowerCase()] || 'Minor'
  }));
}

// Export for popup.js
window.explainViolations = explainViolations;
