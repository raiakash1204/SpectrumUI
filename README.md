# SpectrumUI

<p align="center">
  <img src="icons/icon128.png" alt="SpectrumUI Logo" width="88" />
</p>

<p align="center">
  <strong>Accessibility audits with AI-powered fixes — right inside Chrome.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-blue" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/Manifest-V3-orange" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/AI-Gemini%202.0%20Flash%20Lite-8A2BE2" alt="Gemini" />
  <img src="https://img.shields.io/badge/Engine-axe--core-success" alt="axe-core" />
</p>

---

## ✨ At a Glance

- 🔎 Scan any page using `axe-core`
- 📊 Get a score from `0` to `100`
- 🧠 See plain-English AI explanations + code fixes
- 🎯 Prioritize issues by impact and effort
- 👁 Preview color-vision simulations
- 📝 Export JSON + polished PDF reports
- 💬 Chat with AI Fix Assistant

---

## 🖼 Product Demo

![SpectrumUI Product Demo 1](assets/screenshots/spectrumui-dashboard.png)

![SpectrumUI Product Demo 2](assets/screenshots/spectrumui-results.png)

---

## 🚀 Quick Start

### 1) Clone

```bash
git clone <your-repo-url>
cd SpectrumUI
```

### 2) Add `axe.min.js`

Download from: https://github.com/dequelabs/axe-core/releases

Place file here:

```text
SpectrumUI/
  lib/
    axe.min.js
```

### 3) Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the `SpectrumUI` folder

### 4) Save Gemini API Key

1. Open SpectrumUI
2. Paste key in **Gemini API Key**
3. Click **Save**

Get a key at https://aistudio.google.com

---

## 🧭 Typical Workflow

```mermaid
flowchart LR
  A[Open any webpage] --> B[Click Scan]
  B --> C[axe-core scan]
  C --> D[Score + priority tiers]
  D --> E[Gemini explanations]
  E --> F[Apply fixes]
  F --> G[Export JSON / PDF]
```

---

## 🧰 Feature Breakdown

### Accessibility Scan
- Runs `axe.run(document, { reporter: 'v2' })` in active tab
- Returns violations, passes, incomplete checks
- Works on regular web pages

### AI Explanations
- Uses `gemini-2.0-flash-lite`
- Provides `plainEnglish`, `whoIsAffected`, `codefix`, `severity`
- Retries automatically and falls back safely if needed

### Framework-Aware Fixes
- HTML, React, Next.js, Vue, Angular, Svelte
- Auto-detect + manual override

### Smart Prioritization
- Factors: severity, affected elements, complexity, WCAG tags
- Tiers: `Fix First`, `High`, `Medium`, `Low`

### Visual Accessibility Simulation
- Deuteranopia, Protanopia, Tritanopia
- Achromatopsia (greyscale), low contrast

### Reporting + History
- Export `spectrumui-report.json`
- Download PDF report via jsPDF
- Keep latest 5 domain scans

---

## ⌨ Keyboard Shortcuts

- `Alt+Shift+A` → Trigger scan flow
- `Alt+Shift+S` → Open extension action

---

## 🧠 How Scoring Works

Starts at `100`, subtracts per violation:

- Critical: `-12`
- Serious: `-8`
- Moderate: `-4`
- Minor: `-2`

Final score is clamped to `0..100`.

---

## 🔒 Privacy

### Stored locally
- API key
- Theme and preferences
- Recent scan history

### Sent externally
- Only violation payload needed for AI explanation/chat
- Endpoint: `https://generativelanguage.googleapis.com/*`

No custom backend is used by this project.

---

## 🛡 Permissions

- `activeTab` — run scans and interact with active page
- `scripting` — extension-page script interactions
- `storage` — persist key/settings/history
- `sidePanel` — side panel experience
- `notifications` — warnings for restricted pages

Host permission:
- `https://generativelanguage.googleapis.com/*`

---

## 📁 Project Structure

```text
SpectrumUI/
├─ manifest.json
├─ background.js
├─ content.js
├─ ai.js
├─ chatbot.js
├─ colorblind.js
├─ report.js
├─ popup.html/.css/.js
├─ sidepanel.html/.css/.js
├─ icons/
└─ lib/
   ├─ axe.min.js
   └─ jspdf.umd.min.js
```

---

## 🧪 Troubleshooting

### “Cannot scan this page”
Restricted URLs are blocked (`chrome://`, `about:`, `devtools://`, etc.). Use a regular website URL.

### “axe-core is not loaded”
`lib/axe.min.js` is missing/invalid. Add it, then reload extension.

### AI explanations failed
Usually key/rate-limit/network related. SpectrumUI retries and falls back to non-AI descriptions.

---

## ✅ Release Checklist

- [ ] `lib/axe.min.js` exists
- [ ] icons are present (`16`, `48`, `128`)
- [ ] shortcuts and side panel behavior tested
- [ ] JSON/PDF export tested
- [ ] `manifest.json` version bumped
- [ ] ready for Chrome Web Store packaging

---

## 📜 License

MIT
