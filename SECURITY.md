# Security Policy

Prompt Enhancer handles user-provided Groq API credentials and sends prompt text to the Groq API when the user explicitly triggers an enhancement. Security issues involving credential handling, extension permissions, injected page behavior, or unintended data exposure should be treated as sensitive.

## Reporting a vulnerability

Please do **not** publish API keys, tokens, private prompt contents, or other secrets in a public GitHub issue.

To report a security concern, contact **gultekinhasancan79@gmail.com** with:

- a concise description of the issue,
- affected files or extension behavior,
- reproduction steps,
- expected vs. observed behavior,
- and a minimal proof of concept when relevant.

Do not include real production credentials. Use a revoked/test credential or redact secrets from screenshots and logs.

## Credential exposure

If a Groq API key is accidentally committed, shared publicly, or exposed through logs/screenshots, revoke it immediately in the Groq console and create a replacement key. Removing a secret from the latest commit is not sufficient if it still exists in Git history.

## Current security model

- API credentials are stored locally using `chrome.storage.local`.
- The project has no project-owned backend server.
- Prompt content is sent to Groq only when prompt enhancement is triggered.
- The extension uses Chrome Manifest V3.
- Repository CI validates JavaScript syntax and manifest structure.

This policy does not imply that local browser storage is equivalent to an operating-system credential vault; users should treat browser profile access as sensitive.
