<h1 align="center">Prompt Enhancer</h1>

<p align="center">
  A Chrome extension that improves prompts directly inside popular AI chat interfaces using the Groq API.
</p>

<p align="center">
  <a href="https://github.com/gultekinhasancan79/Oto_prompt_Engineer/actions/workflows/ci.yml"><img src="https://github.com/gultekinhasancan79/Oto_prompt_Engineer/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Manifest-V3-34A853" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Groq-API-F55036" alt="Groq API">
  <img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/License-MIT-2ea44f" alt="MIT License">
</p>

---

## Overview

Prompt Enhancer is a browser extension for refining short, vague, or under-specified prompts **without leaving the AI interface you are already using**.

The extension injects a lightweight enhancement control into supported AI chat applications. When triggered, the current text is sent through a Groq-powered refinement pipeline and the improved prompt is returned to the input field.

The goal is not to answer the user's request. The pipeline is explicitly designed to **rewrite the prompt while preserving its intent and language**.

## Core Features

- **In-place prompt enhancement** inside supported AI websites
- **Iterative refinement** — an already improved prompt can be enhanced again
- **Step-by-step undo** for previous prompt versions
- **Keyboard shortcut** — `Ctrl+Shift+E` on Windows/Linux and `Command+Shift+E` on macOS
- **Language-aware refinement** with Turkish and English handling
- **Local API-key storage** through `chrome.storage.local`
- **Manifest V3 architecture** with a background service worker
- **Groq API integration** using an OpenAI-compatible chat completion endpoint

## Refinement Pipeline

The background worker uses a multi-stage pipeline instead of returning the raw model response directly:

```text
User input
   ↓
LLM refinement
   ↓
Meta-text cleaner
   ↓
Output validator
   ↓
Retry with stricter constraints when needed
   ↓
Whitespace / format normalization
   ↓
Enhanced prompt
```

The validator checks for common failure modes such as explanatory preambles, direct-answer patterns, excessive follow-up questions, banned meta-text, and obvious intent loss.

The current default model configured in the extension is `llama-3.1-8b-instant` through Groq.

## Supported Interfaces

The extension currently injects its content script into interfaces including:

- ChatGPT
- Google Gemini
- Google AI Studio
- Claude
- Perplexity
- Microsoft Copilot
- Poe
- Grok / X
- DeepSeek
- Mistral Chat
- Hugging Face Chat
- You.com
- Pi

Support is based on the URL patterns defined in `manifest.json`; changes to a site's DOM can require selector updates over time.

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/gultekinhasancan79/Oto_prompt_Engineer.git
cd Oto_prompt_Engineer
```

### 2. Load the extension in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository folder.

### 3. Configure a Groq API key

1. Create a Groq API key from the Groq console.
2. Open the Prompt Enhancer extension popup.
3. Paste the key and save it.

The extension validates the key format locally before storing it.

## Usage

1. Open a supported AI chat interface.
2. Write a draft prompt in the text box.
3. Trigger Prompt Enhancer using the injected control or `Ctrl+Shift+E`.
4. Review the refined prompt.
5. Enhance it again if needed, or use undo to return to a previous version.

## Privacy & API-Key Handling

- No API key is committed to this repository.
- The user's key is stored locally in the browser with `chrome.storage.local`.
- The extension requests host access only to the Groq API endpoint for model calls.
- Prompt text is sent to Groq only when an enhancement action is triggered.
- There is no project-owned backend server in the current architecture.

> Never commit API keys into `.env`, `config.json`, source files, or Git history.

## Architecture

```text
manifest.json
├── popup.html / popup.js       → API-key and extension settings
├── content.js                  → page integration and prompt controls
├── styles.css                  → injected UI styling
└── background.js               → Groq call + cleaning/validation pipeline
```

The extension uses Chrome Manifest V3 and keeps model calls in the background service worker rather than directly inside page scripts.

## Current Scope

This project is intentionally lightweight and client-side. Useful next steps include automated tests for the cleaner/validator pipeline, per-site integration tests, a true automatic language mode, clearer model configuration, and packaging for the Chrome Web Store.

## License

MIT
