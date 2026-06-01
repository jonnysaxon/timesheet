# CLAUDE.md

Guidance for Claude / AI coding agents working in this repository.

## What this is

A **single-file, vanilla-JS Progressive Web App** for weekly timesheet tracking.
There is **no framework, no build step, no package manager, and no test suite**.
The entire application — HTML, CSS, and JavaScript — lives in `index.html`.

Do not introduce a build system, bundler, framework, or `node_modules` unless
the user explicitly asks. Keep the "open the file and it runs" property intact.

## Files

| File | Role |
| --- | --- |
| `index.html` | The whole app: markup + `<style>` + `<script>`. Edit here. |
| `sw.js` | Service worker. Pre-caches the app shell (incl. `manifest.json` + icons) at install; network-first for navigation, cache-first for other assets. |
| `manifest.json` | Web app manifest (installable PWA: name, `display:standalone`, theme/bg `#0f1117`, icon entries). |
| `icons/` | PWA icons: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180px, used by iOS), `master-icon-1024.png` (source). |
| `timesheet.html` | Legacy/alternate copy of the app. Usually **not** the file to edit — confirm with the user before touching it. |
| `version.txt` | **Single source of truth for the version.** Fetched at runtime to display the version and drive the update banner. The app no longer hard-codes a version string. |
| `README.md` | Human-facing docs. |
| `IMPROVEMENTS.md` | Backlog of suggested improvements, with ✅ Done markers. |
| `.gitignore` | Ignores OS/editor cruft and local data exports. |

When changing app behavior, edit `index.html`. To release, bump the version in
`version.txt` — it's the single source of truth, read at runtime (the app no
longer hard-codes a version). Also bump `CACHE_VERSION` in `sw.js` if cached
assets changed. See Safety / gotchas for details.

## How to run

It's static — just serve the directory:

```bash
python3 -m http.server 8000   # then open http://localhost:8000/index.html
```

Use an `http://` origin (not `file://`) when testing the service worker, PWA
install, or API calls. There is nothing to compile or lint.

## Architecture & key concepts

All state lives in a single `state` object persisted to `localStorage`:

```
state = { jobs, entries, hours, rollbacks, weekJobs, settings }
```

- **Storage key:** `timesheet_v5`. `loadState()` reads it and runs
  `repairWeekJobs` (which also runs on every GitHub pull and backup import) to
  normalize `weekJobs`. Pre-v5 (`timesheet_v4`) migration was dropped in v1.3.3 —
  if you bump the schema again, add a fresh migration; don't assume old keys are
  still readable.
- **Week model:** weeks run **Saturday → Friday**. `DAYS = ['sat'…'fri']`.
  Weeks are keyed by the local Saturday date (`weekKey` / `localDateKey`).
- **Composite keys:**
  - entries → `jobId__YYYY-MM-DD__day`
  - hours → `h__jobId__YYYY-MM-DD__day`
  - rollbacks → `rb__jobId__YYYY-MM-DD`
  These string formats are load-bearing (regexes parse them in `repairWeekJobs`,
  `weekHasData`, etc.). Don't change them without updating every parser and
  adding a migration.
- **Per-week project visibility:** `state.weekJobs[weekKey]` is the explicit job
  list for a week. A week becomes "persistent" once it has hours/entries or is
  explicitly saved; otherwise edits go to an in-memory `weekDraft` until **Save**.
  This logic lives in `getJobsForCurrentWeek()` / `inheritJobsFromPriorWeek()` and
  is the trickiest part of the app — read it carefully before changing it.
- **Rendering:** plain string-template `innerHTML` builders (`render`,
  `renderJobs`, `renderProjects`, `renderSummary`, `renderHoursSummary`). Always
  pass user-controlled text through `esc()` to avoid HTML injection.

## External integrations (all optional, all user-keyed)

- **Anthropic API** (`expandWithAI`): direct browser call to `api.anthropic.com`
  for AI entry expansion. The model comes from `state.settings.aiModel` and falls
  back to the `DEFAULT_AI_MODEL` constant near the top of the script
  (currently `claude-sonnet-4-20250514`) — don't re-hard-code it inline. API key
  comes from settings; never hard-code or log it.
- **GitHub sync** (`ghPush` / `ghPullNow`): stores `state` as
  `timesheet-data.json` via the GitHub Contents API. `ghPush()` does a
  SHA-based conflict check — it compares the remote SHA against `ghLastSha` (the
  SHA local state is based on) and throws a conflict instead of clobbering when
  the remote has moved; `ghPushNow()` then asks the user to overwrite or pull.
  Pass `ghPush({force:true})` to skip the check. Still effectively last-write-wins
  *after* the user's explicit choice (no field-level merge).
- **SheetJS (xlsx)**: loaded from CDN for Excel export, and pre-cached
  best-effort by the service worker.

## Conventions

- Match the existing **terse, ES5-flavored vanilla JS** style: `var`,
  `function(){}`, no arrow functions / modules / classes. Keep new code
  consistent with its neighbors rather than modernizing surrounding code.
- Inline event handlers (`onclick="..."`) are the established pattern.
- Keep CSS in the single `<style>` block; theming uses CSS custom properties
  with a `body.light` override — reuse the existing `--vars`. Prefer the shared
  utility classes (`.panel-header`, `.sensitive-display`, `.mask-text`,
  `.btn-mini`, `.btn-mini-danger`, `.confirm-message`) over new inline styles.
- Use `appConfirm(msg, opts)` instead of raw `confirm()` for destructive actions.
  It returns a `Promise<boolean>` (so the caller must be `async` and `await` it)
  and drives the in-app `#confirmModal`, which works inside sandboxed iframes
  where native `confirm()` does not. `opts` supports `title`, `okText`,
  `cancelText`, and `danger` (set `danger:false` for non-destructive blue
  confirms). The old synchronous `safeConfirm()` has been removed.

## Safety / gotchas

- **Never commit or print secrets.** API keys and GitHub tokens live only in the
  user's `localStorage`.
- **Preserve backward compatibility** of `localStorage` data and the composite
  key formats — real user data depends on it. Add migrations, don't break loads.
- **Versioning (single source of truth).** `version.txt` is the only place the
  version string is authored. At startup the app fetches it (cache-bypassing),
  anchors it as `BOOT_VERSION`/`APP_VERSION`, and on later fetches shows the
  update banner if the published value differs from `BOOT_VERSION`. So:
  1. On any user-facing change, bump `version.txt`. That's it for the version —
     there is no `APP_VERSION` literal to keep in sync anymore (`APP_VERSION` is
     a runtime variable populated from `version.txt`, initially `null`). Use the
     **NZ date** (`Pacific/Auckland`) in the `version.txt` date stamp, consistent
     with the app's `en-NZ` locale everywhere else.
  2. Bump `CACHE_VERSION` in `sw.js` **if cached assets changed**, so the
     pre-cached copy is refreshed rather than served stale.
  - The service worker serves `version.txt` network-first (never stale), so the
    update signal is always fresh; everything else is cache-first.
  - Update detection runs independently of service-worker registration, so the
    version still displays and updates are still caught even if the SW fails.
- There is no committed test suite; verify changes by loading the app in a
  browser and exercising the affected tab (Entry / Summary / Hours / Projects)
  plus a week-navigation round-trip. For larger changes, a headless browser
  (e.g. Puppeteer) driving the global functions on `index.html` works well —
  that's how the v1.3.0 changes were verified.

## Git / workflow

- Do not create branches, commit, or push unless asked. Do not open a PR unless
  the user explicitly requests one.
- Keep changes minimal and scoped; this is a personal tool where data integrity
  matters more than refactors.
- **One PR per logical change, always branched off `main`.** Do not stack PRs on
  top of another open PR's branch — if a base branch is deleted on merge, the
  stacked PR is orphaned (auto-closed) and can't be retargeted. Collapse related
  work into a single PR rather than chaining dependent ones.
