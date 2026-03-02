# SpectrumUI Release Notes

## v1.0.0 — Initial Public Release (March 1, 2026)

This is the first public release of SpectrumUI.

SpectrumUI brings AI-assisted accessibility auditing to Chrome with a practical workflow: scan, prioritize, fix, and export.

---

## 🚀 Highlights

- Accessibility scanning powered by `axe-core`
- AI-generated explanations and fix suggestions via Gemini
- Priority scoring to help teams fix the most impactful issues first
- Built-in color blindness simulator for quick visual accessibility checks
- Export options for both JSON and PDF reports
- Side panel experience with optional auto re-scan on navigation

---

## ✨ What’s Included

### Scanning & Analysis
- One-click page audits from popup/side panel
- Accessibility score from `0` to `100`
- Violation summary: violations, passes, incomplete
- Blocked-page protection for unsupported browser URLs

### AI Accessibility Assistant
- Plain-English explanation of each violation
- “Who is affected” context for issue impact
- Actionable code-fix output
- Retry + fallback behavior if AI requests fail

### Framework-Aware Fixes
- Supports:
  - HTML
  - React
  - Next.js
  - Vue
  - Angular
  - Svelte
- Automatic framework detection with manual override

### Remediation Workflow Tools
- Priority tiers: `Fix First`, `High`, `Medium`, `Low`
- Violation sorting and severity filtering
- In-page element highlight for faster debugging
- “Fix Prompt” generator for external LLM workflows
- Integrated AI chat assistant for follow-up questions

### Visual Simulation
- Deuteranopia
- Protanopia
- Tritanopia
- Achromatopsia (greyscale)
- Low-contrast simulation

### Reporting & History
- Export report as `spectrumui-report.json`
- Generate PDF report via jsPDF
- Keep recent scan history (up to 5 domains)

### UX & Productivity
- Dark/light theme preference
- Keyboard shortcuts:
  - `Alt+Shift+A` scan trigger flow
  - `Alt+Shift+S` open extension action

---

## 🔒 Privacy & Data

- Runs primarily client-side in the browser
- Stores API key and preferences in `chrome.storage.local`
- Sends only required AI payloads to:
  - `https://generativelanguage.googleapis.com/*`
- No custom SpectrumUI backend service in this release

---

## 🛡 Permissions Used

- `activeTab`
- `scripting`
- `storage`
- `sidePanel`
- `notifications`
- Host permission: `https://generativelanguage.googleapis.com/*`

---

## ⚠ Known Limitations

- Restricted browser URLs cannot be scanned (`chrome://`, `about:`, `devtools://`, etc.)
- Automated scanning does not replace full manual accessibility audits
- AI output quality can vary with model availability and rate limits

---

## ✅ Upgrade / Install Notes

- Ensure `lib/axe.min.js` is present before loading unpacked extension
- Add your Gemini API key in the extension UI to enable AI explanations/chat
- Reload extension after updates from `chrome://extensions`

---

## 🔜 Next Focus Areas

- Richer reporting options and team workflows
- Better regression comparison between scans
- Improved export formats and CI handoff support
