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
  professional timesheet comments using the Anthropic API. The model is
  configurable in Settings (defaults to a current Claude Sonnet). Each expansion
  can be rolled back.
- **Global search (🔍 in the header)** — search every entry across all weeks by
  text or project code, with optional per-project and date-range filters.
  Results are listed as dated entries grouped by week; tapping one jumps
  straight to that week with the project card opened.
- **AI review summaries** *(optional)* — from the Projects tab, generate a
  performance-review-ready summary of any project (or **all projects**) over a
  chosen date range (presets or custom). Two styles: **Deliverables**
  (overview / key accomplishments / skills — written for pasting into a review
  tool such as goPerform) or **Timeline** (month-by-month narrative). Includes
  total hours for the range, copy-to-clipboard, regenerate, and a saved-summary
  history (last 20) so drafts can be compared or re-copied without regenerating.
- **Email & Excel export** — email a formatted weekly summary, or download the
  week as an `.xlsx` spreadsheet (via SheetJS).
- **GitHub sync** *(optional)* — store your data as `timesheet-data.json` in a
  private GitHub repo so it follows you across devices. Auto-syncs on save, and
  detects conflicts (if another device synced more recently, it asks whether to
  overwrite or pull instead of silently clobbering).
- **Backup & restore** — export/import all data as a JSON file (handy before iOS
  updates), with a built-in reminder when your last backup gets stale.
- **Light/dark theme**, in-app confirmation dialogs for destructive actions, and
  an offline-capable service worker (pre-caches the app shell) that surfaces new
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
| **AI model** | Anthropic model used for AI Expand. Blank uses the app default. |
| **App URL** | Your hosted URL, used by the update checker. |
| **GitHub sync** | Fine-grained PAT + `owner/repo` for cross-device sync. |

### GitHub sync setup

1. Create a **private** repo to hold your data (e.g. `you/timesheet-data`).
2. Create a **fine-grained personal access token** with **Contents: read & write**
   scoped to that repo only.
3. Paste the token and `owner/repo` into Settings, then **Test** and **Push**.

Data is saved to `timesheet-data.json` in that repo and pulled automatically on
load. The synced file contains your timesheet data and non-secret preferences
only — your GitHub token and Anthropic API key are **never** included.

### Using it from a computer (Windows / Mac)

The app works in any modern browser, so a second (or third) device just needs a
one-time setup:

1. Open your hosted URL (e.g. the GitHub Pages address) in Edge or Chrome.
2. Open **Settings ⚙** and enter your GitHub token + `owner/repo`
   (and your Anthropic API key if you use the AI features), then **Pull**.
3. *(Optional)* Install it as an app: Edge → **⋯ → Apps → Install this site as
   an app** (Chrome: **Install page as app**) to get its own window and
   taskbar icon.

Keys are stored per browser profile, so each device needs them entered once —
keep both in a password manager. After that, GitHub sync keeps every device on
the same data, and the app warns you if two devices edit the same file
concurrently.

---

## Data & privacy

- All timesheet data lives in your browser's `localStorage` under the key
  `timesheet_v5` (this includes saved AI review summaries, so treat backups
  and the synced `timesheet-data.json` as sensitive).
- The **only** outbound network calls are the ones you opt into:
  the Anthropic API (AI expansion) and the GitHub API (sync). The app also loads
  the SheetJS library and IBM Plex fonts from CDNs.
- Your API key and GitHub token never leave your device except to their
  respective services. They are stripped from the GitHub-synced
  `timesheet-data.json` (each device keeps its own copy locally), but they
  **are** included in exported backup JSON files — treat backups as sensitive.
- On startup the app requests [persistent storage](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
  so the browser is less likely to auto-evict your local data under storage
  pressure. GitHub sync remains the real safety net if storage is ever cleared.

---

## Project structure

| File | Description |
| --- | --- |
| `index.html` | The entire app — markup, CSS, and vanilla JS in one file. |
| `sw.js` | Service worker (network-first navigation for instant updates). |
| `manifest.json` | Web app manifest (name, theme color, icons) for installable PWA. |
| `icons/` | App icons: `icon-192.png`, `icon-512.png` (standard), `icon-maskable-192.png`, `icon-maskable-512.png` (Android adaptive/maskable), `apple-touch-icon.png` (iOS, 180px), `favicon.ico` + `favicon-32.png` (browser tab), the `master-icon-1024.png` raster master, and `icon.svg` / `icon-maskable.svg` vector sources. |
| `timesheet.html` | Redirect stub to `index.html` (kept so old bookmarks/links still work). |
| `version.txt` | **The single source of truth for the app version.** Fetched at runtime to display the version and drive the update banner. |
| `CLAUDE.md` | Guidance for AI coding agents working in this repo. |

### Versioning & updates

`version.txt` holds the version string and is the **only** place it's authored —
the app no longer hard-codes a version anywhere. On load the app fetches
`version.txt` (bypassing the cache) and anchors that as the running version;
later checks (every 5 minutes and when the tab regains focus) that see a
different value mean a newer version was published, so the app shows a "New
version available" banner that reloads to the latest. **To release a new
version, just edit `version.txt`** (and bump `CACHE_VERSION` in `sw.js` if cached
assets changed). There is no second version constant to keep in sync.

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
