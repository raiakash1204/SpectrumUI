# SpectrumUI

An AI-powered Chrome Extension that scans any webpage for accessibility issues using [axe-core](https://github.com/dequelabs/axe-core), scores the page from 0–100, and uses the Google Gemini API to explain each violation in plain English with specific code fixes.

---

## Prerequisites

- **Google Chrome** (version 116 or later recommended)
- **Google Gemini API key** — Get one free at [aistudio.google.com](https://aistudio.google.com)

---

## Setup

### 1. Clone or download this folder

```bash
git clone <repo-url>
cd spectrumui
```

Or download and extract the ZIP.

### 2. Download axe-core

Download `axe.min.js` from the [axe-core GitHub releases](https://github.com/dequelabs/axe-core/releases) (v4.x recommended).

Place it at:

```
spectrumui/
  lib/
    axe.min.js    ← place here
```

Create the `lib/` folder if it doesn't exist:

```bash
mkdir lib
```

### 3. Load the extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer Mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `spectrumui` folder (the one containing `manifest.json`)

### 4. Enter your API key

#### Getting a Free Gemini API Key:
1. Go to https://aistudio.google.com
2. Sign in with your Google account
3. Click "Get API Key" in the left sidebar
4. Click "Create API key" and copy it
5. Paste it into the extension popup and click **Save**

> **Note:** The free tier of Gemini API includes gemini-2.0-flash-lite which is
> sufficient for this extension. No credit card required.

Your key is stored locally in `chrome.storage.local` and never sent anywhere except the Google Gemini API.

---

## How to Use

1. **Navigate** to any website you want to audit
2. **Click** the SpectrumUI extension icon in the toolbar, then click **Scan Page**
3. **Review** the accessibility score, violation cards with AI explanations, and use the highlight feature to locate issues on the page

---

## Tech Stack

| Component        | Technology                                                        |
| ---------------- | ----------------------------------------------------------------- |
| Extension        | Chrome Extension Manifest V3                                      |
| Accessibility    | [axe-core](https://github.com/dequelabs/axe-core) v4.x           |
| AI Explanations  | [Gemini 2.0 Flash Lite](https://ai.google.dev/) — Google AI free tier AI explanations |
| UI               | Vanilla HTML / CSS / JavaScript                                   |
| Fonts            | Inter (UI), JetBrains Mono (code) via Google Fonts                |

---

## Features

- **Accessibility Score** — 0–100 score with color-coded circular gauge
- **AI Explanations** — Gemini translates technical violations into plain English
- **Code Fixes** — Each violation includes a suggested code fix
- **Element Highlighting** — Click "Highlight" to locate the offending element on the page
- **JSON Export** — Download the full report as `spectrumui-report.json`
- **Graceful Degradation** — Works without an API key (shows raw axe-core descriptions)

---

## Known Limitations

- **Chrome internal pages** — Cannot scan `chrome://`, `about:`, `edge://`, or `brave://` pages
- **PDF pages** — PDF viewer pages cannot be scanned
- **Strict CSP** — Pages with very strict Content Security Policy may block the content script injection
- **API rate limits** — The Gemini API has rate limits; very large violation sets may be truncated
- **Automated checks only** — axe-core catches ~30–40% of WCAG issues; manual testing is still recommended

---

## File Structure

```
spectrumui/
├── manifest.json      # Extension manifest (MV3)
├── popup.html         # Popup UI markup
├── popup.css          # Popup styles (dark theme)
├── popup.js           # Popup logic & rendering
├── ai.js              # Gemini API integration
├── content.js         # Content script (axe scan + highlighting)
├── background.js      # Service worker (message relay)
├── icons/
│   └── icon48.png     # Extension icon
├── lib/
│   └── axe.min.js     # axe-core (user-provided)
└── README.md          # This file
```

---

## License

MIT
