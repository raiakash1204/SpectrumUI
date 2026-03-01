# SpectrumUI

SpectrumUI is a Chrome Extension (Manifest V3) for fast, AI-assisted accessibility audits.
It runs `axe-core` directly on the active page, calculates a 0–100 accessibility score, prioritizes issues, and generates actionable fixes using Gemini.

Designed for developers, QA teams, and accessibility reviewers who want practical remediation guidance—not just raw rule violations.

---

## Table of Contents

- [What SpectrumUI Does](#what-spectrumui-does)
- [Core Features](#core-features)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Usage Guide](#usage-guide)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Configuration](#configuration)
- [Privacy & Data Handling](#privacy--data-handling)
- [Permissions Explained](#permissions-explained)
- [Project Structure](#project-structure)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)
- [Release Checklist](#release-checklist)
- [Roadmap Ideas](#roadmap-ideas)
- [License](#license)

---

## What SpectrumUI Does

SpectrumUI combines automated accessibility testing and AI explanation in one workflow:

1. Scans the current page with `axe-core`
2. Computes an accessibility score from violation severity
3. Ranks violations by practical fix priority
4. Uses Gemini to explain each issue in plain English with code fixes
5. Lets you highlight affected elements in-page
6. Exports audit results as JSON or PDF

It also includes an AI chat assistant, framework-aware fix generation, recent scan history, and a color blindness simulator for quick visual checks.

---

## Core Features

### 1) Accessibility Audit Engine
- Runs `axe.run(document, { reporter: 'v2' })` in the content script
- Returns violations, pass count, incomplete count, and page URL
- Works on most standard HTTP/HTTPS pages

### 2) AI-Powered Explanations (Gemini)
- Uses `gemini-2.0-flash-lite`
- Generates structured explanation fields per rule:
  - `id`
  - `plainEnglish`
  - `whoIsAffected`
  - `codefix`
  - `severity`
- Retries on failure and falls back to safe non-AI descriptions when needed

### 3) Framework-Aware Fix Suggestions
- Supports:
  - Plain HTML
  - React
  - Next.js
  - Vue
  - Angular
  - Svelte
- Auto-detects framework on the active page (with manual override)

### 4) Prioritized Remediation Workflow
- Each violation receives a priority score based on:
  - Severity
  - Number of affected elements
  - Estimated fix complexity
  - WCAG tag impact
- Priority tiers:
  - Fix First
  - High
  - Medium
  - Low

### 5) Developer Productivity Tools
- Highlight offending elements on the page
- Sort/filter violations by severity, priority, element count, and complexity
- Generate “Fix Prompt” text for use in external LLM workflows
- Built-in AI chat panel for follow-up implementation help

### 6) Reporting & History
- Export full scan as `spectrumui-report.json`
- Generate client-ready PDF report (local jsPDF)
- Track up to 5 recent scans (domain-based history)

### 7) Visual Accessibility Preview
- Color blindness simulation modes:
  - Deuteranopia
  - Protanopia
  - Tritanopia
  - Achromatopsia (greyscale)
  - Low contrast simulation

### 8) Side Panel Experience
- Extension opens in Chrome side panel
- Current page indicator (title/favicon)
- Optional auto re-scan on navigation

---

## How It Works

### Runtime Flow

1. UI (`popup.js` / `sidepanel.js`) triggers scan
2. Message is relayed through `background.js`
3. `content.js` runs axe on the active tab
4. Results are returned to UI
5. Score and priorities are computed client-side
6. If API key exists, `ai.js` requests Gemini explanations
7. Results are rendered, and optionally exported/chat-enabled

### Scoring Model

Score starts at 100 and subtracts severity penalties per violation:

- Critical: `-12`
- Serious: `-8`
- Moderate: `-4`
- Minor: `-2`

Final score is clamped to `0..100`.

---

## Installation

### Prerequisites

- Google Chrome (recent stable version recommended)
- Gemini API key from https://aistudio.google.com
- `axe.min.js` (v4.x recommended) placed in `lib/`

### 1) Clone repository

```bash
git clone <your-repo-url>
cd SpectrumUI
```

### 2) Add axe-core

Download `axe.min.js` from:
https://github.com/dequelabs/axe-core/releases

Place it at:

```text
SpectrumUI/
  lib/
    axe.min.js
```

> `lib/README.txt` documents this requirement.

### 3) Load unpacked extension

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the `SpectrumUI` folder (contains `manifest.json`)

### 4) Add Gemini API key

1. Open SpectrumUI
2. Paste key into **Gemini API Key** field
3. Click **Save**

Key is stored in `chrome.storage.local` as `geminiApiKey`.

---

## Usage Guide

### Basic Scan

1. Open any public website page
2. Open SpectrumUI (extension action / side panel)
3. Click **Scan Page**
4. Review score, summary, and prioritized violation cards

### AI-Assisted Workflow

1. Save Gemini API key
2. Select target framework (or accept auto-detected)
3. Run scan
4. Review AI-generated explanations and code fixes
5. Open **AI Chat** for guided remediation

### Export Workflow

- **Export JSON Report** for raw structured data
- **Download PDF Report** for stakeholder sharing
- **Generate Fix Prompt** for external LLM pair-fixing workflows

### Side Panel Workflow

- Keep side panel open while navigating
- Enable **Auto re-scan on navigation** if desired
- Use recent scans to quickly re-open previously audited pages

---

## Keyboard Shortcuts

Configured in `manifest.json`:

- `Alt+Shift+A` → Trigger scan flow (`trigger-scan`)
- `Alt+Shift+S` → Open extension action (`_execute_action`)

When triggered via shortcut, SpectrumUI sets an `autoScan` flag and starts scan automatically after UI opens.

---

## Configuration

### Stored Settings (`chrome.storage.local`)

- `geminiApiKey` → Gemini API key
- `theme` → `dark` / `light`
- `selectedFramework` → active framework mode
- `autoRescan` → side panel navigation auto-scan toggle
- `lastColorSim` → last selected color simulation preset
- `scanHistory` → recent scan entries (up to 5)
- `autoScan`, `autoScanTabId` → keyboard shortcut handoff state

---

## Privacy & Data Handling

SpectrumUI is primarily client-side and runs in-browser.

### What stays local
- API key (`chrome.storage.local`)
- Scan results shown in UI
- Recent scan history and user preferences

### What is sent externally
- Only violation payloads required for AI explanation/chat are sent to:
  `https://generativelanguage.googleapis.com/*`

### Notable behavior
- If no API key is configured, SpectrumUI still works with non-AI fallback explanations.
- No separate backend server is used by this project.

---

## Permissions Explained

From `manifest.json`:

- `activeTab`: run scans and interact with the currently active page
- `scripting`: extension script interactions with page context
- `storage`: save API key, preferences, history, and session flags
- `sidePanel`: run SpectrumUI in Chrome side panel
- `notifications`: notify user for blocked shortcut scans on non-scannable pages

Host permission:

- `https://generativelanguage.googleapis.com/*`: Gemini API requests

---

## Project Structure

```text
SpectrumUI/
├─ manifest.json          # MV3 configuration, permissions, commands
├─ background.js          # Service worker: side panel + message relay + shortcuts
├─ content.js             # axe scan runner, highlight actions, framework detection, color filters
├─ ai.js                  # Gemini explanation pipeline with retries/fallbacks
├─ chatbot.js             # AI conversational fix assistant
├─ colorblind.js          # Color simulation controller
├─ report.js              # PDF report generation via jsPDF
├─ popup.html/.css/.js    # Popup UI and behavior
├─ sidepanel.html/.css/.js# Side panel UI and behavior
├─ icons/                 # Extension icons
└─ lib/
   ├─ axe.min.js          # Required external dependency (manual add)
   └─ jspdf.umd.min.js    # Bundled PDF library
```

---

## Development

### Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript, HTML, CSS
- `axe-core` for accessibility rule evaluation
- Gemini (`gemini-2.0-flash-lite`) for AI explanations/chat
- jsPDF for local PDF generation

### Local Development Loop

1. Edit source files
2. Reload extension on `chrome://extensions`
3. Re-open popup/side panel and test

No build step or bundler is required.

### Recommended QA Cases

- Scan pages with known critical violations (missing alt, form labels, contrast)
- Scan with and without API key
- Test each framework mode for code-fix formatting
- Verify blocked pages (`chrome://`, `devtools://`, extension pages)
- Validate JSON/PDF export output
- Test shortcut trigger and side-panel auto re-scan

---

## Troubleshooting

### “Cannot scan this page”

Expected on restricted URLs such as:

- `chrome://*`
- `about:*`
- `edge://*`
- `brave://*`
- `devtools://*`
- `chrome-extension://*`

Open a regular website page and retry.

### “axe-core is not loaded”

`lib/axe.min.js` is missing or invalid.

Fix:
1. Download `axe.min.js` from official releases
2. Place it in `lib/`
3. Reload extension

### AI explanation failures

Possible causes:

- Invalid/expired Gemini API key
- Gemini rate limits
- Network failures
- Non-JSON model response in edge cases

Behavior:
- SpectrumUI retries
- Falls back to non-AI descriptions when needed
- May show warning banner for partial AI failures

### No content-script response after navigation

Try refreshing the page and scanning again.

---

## Known Limitations

- Automated testing does not replace manual accessibility QA
- Some pages with unusual CSP/sandbox behavior can reduce extension interaction
- AI output quality depends on model responses and rate-limit conditions
- Current history is intentionally lightweight (latest 5 domain entries)

---

## Release Checklist

Before publishing:

- [ ] Ensure `lib/axe.min.js` is present
- [ ] Verify icons in `icons/` are valid (16/48/128)
- [ ] Validate all shortcuts and side panel behaviors
- [ ] Run smoke tests on multiple websites
- [ ] Confirm privacy statement and store listing copy are aligned
- [ ] Bump extension version in `manifest.json`
- [ ] Package and submit to Chrome Web Store

---

## Roadmap Ideas

- Team/shared report mode
- Diff between two scans for regression tracking
- More export formats (CSV, SARIF)
- Rule suppression annotations for known exceptions
- CI handoff schema for pipeline integration

---

## License

MIT

