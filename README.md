# ⚡ Quiz Master AI

> Turn AI-generated MCQs into a full interactive quiz — in one click.

![Chrome](https://img.shields.io/badge/Chrome-Supported-4285F4?style=flat&logo=googlechrome&logoColor=white)
![Edge](https://img.shields.io/badge/Edge-Supported-0078D7?style=flat&logo=microsoftedge&logoColor=white)
![Brave](https://img.shields.io/badge/Brave-Supported-FB542B?style=flat&logo=brave&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-6C63FF?style=flat)
![Vanilla JS](https://img.shields.io/badge/Built%20with-Vanilla%20JS-F7DF1E?style=flat&logo=javascript&logoColor=black)

---

## 🧠 The Problem

AI tools like ChatGPT and Gemini can generate MCQs on any topic instantly.

But the quiz *experience* is missing.

Want a timer? → Another prompt.  
Want difficulty filtering? → Another prompt.  
Want weak topic analysis? → Another prompt.  
Want progress tracking? → Not really built in.

**Quiz Master AI solves this.**

---

## 🚀 What It Does

A Chrome/Edge browser extension that works directly inside **ChatGPT** and **Gemini**.

It detects AI-generated MCQs automatically, and with one click converts them into a complete interactive quiz — right in the side panel.

**No copy-pasting. No extra prompts. Just click Launch Quiz.**

---

## ⚡ How It Works

```
1. Ask ChatGPT or Gemini → "Give me 20 MCQs on Operating Systems"
2. Extension detects the MCQs automatically
3. Click ⚡ Launch Quiz below the response
4. Extension silently re-prompts the AI to convert MCQs to structured JSON
5. Full quiz loads in the side panel instantly
```

---

## 🎯 Features

| Feature | Description |
|---|---|
| **Auto MCQ Detection** | Detects questions using 3 parallel strategies — never misses a question |
| **Difficulty Filter** | Filter by Easy / Medium / Hard before starting |
| **Custom Question Count** | Choose 5, 10, 15 or all — built dynamically from what AI generated |
| **Timer Mode** | Countdown per question — amber at 20s, red at 10s, auto-submit at 0 |
| **Confidence Tagging** | Mark Sure / Unsure / Guessing before each answer |
| **Explanation Mode** | Correct explanation shown after every answer |
| **Weak Topic Detection** | Calculates score per topic, alerts you to your weakest area |
| **Lucky Guess Detection** | Flags questions you got right but marked as Guessing |
| **Progress History** | Saves your last 20 quiz scores with dates |
| **PDF Export** | Download a full results report |
| **New MCQ Support** | Each AI response gets its own independent Launch Quiz button |

---

## 🖥️ Supported Browsers

| Browser | Status |
|---|---|
| Chrome | ✅ Full support |
| Edge | ✅ Full support (opens as tab) |
| Brave | ✅ Works out of the box |
| Opera | ✅ Works out of the box |
| Firefox | ❌ Not supported |
| Safari | ❌ Not supported |

---

## 📦 Installation

Since this extension is not yet on the Chrome Web Store, install it manually in a few steps:

### Step 1 — Download
Click the green **Code** button on this page → **Download ZIP** → Unzip the folder.

### Step 2 — Load into Chrome / Edge / Brave
1. Open your browser and go to:
   - Chrome → `chrome://extensions`
   - Edge → `edge://extensions`
   - Brave → `brave://extensions`
2. Enable **Developer Mode** (toggle in the top right corner)
3. Click **Load unpacked**
4. Select the `quiz-extension` folder you unzipped

### Step 3 — Pin the extension
Click the puzzle icon in your toolbar → find **Quiz Master AI** → click the pin icon.

### Step 4 — Start using it
1. Go to [ChatGPT](https://chatgpt.com) or [Gemini](https://gemini.google.com)
2. Ask: *"Give me 20 MCQs on [your topic]"*
3. Click the **⚡ Launch Quiz** button that appears below the response
4. Click the toolbar icon to open the side panel
5. Choose your settings and click **Begin Quiz**

---

## 🗂️ File Structure

```
quiz-extension/
├── manifest.json         # Extension config — permissions, host URLs, file mapping
├── background.js         # Service worker — handles storage and side panel
├── content.js            # Injected into AI pages — detects MCQs, adds Launch Quiz button
├── content.css           # Styles for the Launch Quiz button
├── sidepanel.html        # Quiz UI — all screens (waiting, config, quiz, results)
├── sidepanel.js          # All quiz logic — rendering, scoring, results, PDF export
├── jspdf.umd.min.js      # Bundled PDF library (CDN blocked in extensions)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🛠️ Tech Stack

- **Vanilla JavaScript** — no frameworks
- **Chrome Extension Manifest V3**
- **jsPDF** — bundled locally for PDF export
- **chrome.storage.local** — cross-context data sharing between content script and side panel

---

## 🔍 How MCQ Detection Works

The extension uses **3 parallel detection strategies** and takes the highest count:

1. **Numbered lines** — counts lines like `1.` `Q1.` `Question 1.`
2. **Option clusters** — counts `A)` `B)` `C)` `D)` lines and divides by 4
3. **Answer lines** — counts `Answer:` or `Ans:` lines directly

This makes detection reliable across different AI response formats.

---

## 🤝 Contributing

Found a bug? Have a feature idea? Feel free to open an issue or submit a pull request. All contributions are welcome!

---

## 📄 License

MIT License — free to use, modify, and share.

---

<p align="center">Built for students who use AI to study 🎓</p>
