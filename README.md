# Weekly Timesheet

A lightweight, single-file web app for tracking weekly work against project/job
codes. It runs entirely in the browser, stores everything locally, and works
offline as an installable Progressive Web App (PWA) — built primarily for use on
iPhone/iPad (iOS Safari → "Add to Home Screen") but works in any modern browser.

No build step, no server, no account. Open `index.html` and start typing.

---

## Features

- **Week-at-a-glance entry** — a card per project, with a notes box and an hours
  field for each day. The work week runs **Saturday → Friday**.
- **Per-week project lists** — each week tracks its own set of active projects.
  New weeks inherit the project list from the most recent prior week (open
  projects only).
- **Projects tab** — add/edit/close/reopen project codes, set an optional total
  hour budget, and see hours logged vs. budget (with over-budget highlighting).
- **Summary tab** — a clean, copyable text summary of the week's notes per
  project, ready to email.
- **Hours tab** — a per-project × per-day hours grid with row/column totals.
- **AI entry expansion** *(optional)* — turn rough day notes into polished,
  professional timesheet comments using the Anthropic API. Each expansion can be
  rolled back.
- **Email & Excel export** — email a formatted weekly summary, or download the
  week as an `.xlsx` spreadsheet (via SheetJS).
- **GitHub sync** *(optional)* — store your data as `timesheet-data.json` in a
  private GitHub repo so it follows you across devices. Auto-syncs on save.
- **Backup & restore** — export/import all data as a JSON file (handy before iOS
  updates), with a built-in reminder when your last backup gets stale.
- **Light/dark theme** and a network-first service worker that surfaces new
  versions automatically.

---

## Getting started

Because everything is client-side, you just need to serve the static files.

### Run locally

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

Any static file server works (`npx serve`, VS Code Live Server, etc.). Opening
`index.html` directly via `file://` mostly works, but a real `http(s)://` origin
is required for the service worker, "Add to Home Screen", and reliable API calls.

### Deploy (GitHub Pages)

This app is designed to be hosted on GitHub Pages:

1. Push these files to a repo.
2. Enable **Settings → Pages**, serving from the branch root.
3. Visit `https://<you>.github.io/<repo>/index.html`.
4. (Optional) Put that URL in **Settings → App URL** so the in-app "Reload
   Latest Version" button can pull updates past the Safari cache.

---

## Configuration (in-app Settings ⚙)

All settings are stored **only on your device** (in `localStorage`).

| Setting | Purpose |
| --- | --- |
| **Anthropic API key** | Enables AI expansion. Sent only to `api.anthropic.com`. |
| **Your email** | Pre-fills the To: field when emailing a summary. |
| **Your role** | Gives the AI professional context (e.g. "Oracle DBA"). |
| **App URL** | Your hosted URL, used by the update checker. |
| **GitHub sync** | Fine-grained PAT + `owner/repo` for cross-device sync. |

### GitHub sync setup

1. Create a **private** repo to hold your data (e.g. `you/timesheet-data`).
2. Create a **fine-grained personal access token** with **Contents: read & write**
   scoped to that repo only.
3. Paste the token and `owner/repo` into Settings, then **Test** and **Push**.

Data is saved to `timesheet-data.json` in that repo and pulled automatically on
load.

---

## Data & privacy

- All timesheet data lives in your browser's `localStorage` under the key
  `timesheet_v5` (a v4 → v5 migration runs automatically for older data).
- The **only** outbound network calls are the ones you opt into:
  the Anthropic API (AI expansion) and the GitHub API (sync). The app also loads
  the SheetJS library and IBM Plex fonts from CDNs.
- Your API key and GitHub token never leave your device except to their
  respective services. Treat the exported backup JSON as sensitive.

---

## Project structure

| File | Description |
| --- | --- |
| `index.html` | The entire app — markup, CSS, and vanilla JS in one file. |
| `sw.js` | Service worker (network-first navigation for instant updates). |
| `timesheet.html` | An earlier/alternate single-file version (see note below). |
| `version.txt` | Plain-text version marker. |
| `CLAUDE.md` | Guidance for AI coding agents working in this repo. |

> **Note:** the in-app version (`APP_VERSION` in `index.html`) is the source of
> truth. `timesheet.html` and `version.txt` appear to be legacy artifacts — see
> "Suggested improvements" below.

---

## Tech stack

- Vanilla HTML / CSS / JavaScript — **no framework, no build tooling**.
- [SheetJS (xlsx)](https://sheetjs.com/) via CDN for Excel export.
- Anthropic Messages API for optional AI expansion.
- GitHub Contents API for optional sync.
- Service worker + manifest behavior for PWA/offline use.

## Browser support

Targets modern evergreen browsers, with iOS Safari as the primary platform.
Requires JavaScript and `localStorage`. The service worker and install-to-home
features require an HTTPS (or localhost) origin.

---

## Suggested improvements

A prioritized list of potential improvements (consolidating the duplicate HTML
files, adding a web app manifest, configurable AI model, service-worker
pre-caching, sync conflict handling, `LICENSE`, `.gitignore`, and more) lives in
[`IMPROVEMENTS.md`](IMPROVEMENTS.md).

---

## License

No license file is currently included; add one to define how others may use
this project.
