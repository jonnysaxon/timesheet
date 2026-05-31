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
| `sw.js` | Service worker. Network-first for navigation requests. |
| `timesheet.html` | Legacy/alternate copy of the app. Usually **not** the file to edit — confirm with the user before touching it. |
| `version.txt` | Plain-text version marker (legacy). |
| `README.md` | Human-facing docs. |

When changing app behavior, edit `index.html`. The authoritative version string
is the `APP_VERSION` constant near the top of the script block.

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

- **Storage key:** `timesheet_v5` (with `loadState()` migrating from `v4` and
  running `migrateWeekKeysToLocal` / `repairWeekJobs` on load). Bump the schema
  carefully and preserve migration paths.
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

- **Anthropic API** (`callAnthropicAPI`): direct browser call to
  `api.anthropic.com` for AI entry expansion. Model is currently hard-coded
  (`claude-3-5-sonnet-20241022`). API key comes from settings; never hard-code or
  log it.
- **GitHub sync** (`ghPush` / `ghPull` / `ghReq`): stores `state` as
  `timesheet-data.json` via the GitHub Contents API. Last-write-wins.
- **SheetJS (xlsx)**: loaded from CDN for Excel export.

## Conventions

- Match the existing **terse, ES5-flavored vanilla JS** style: `var`,
  `function(){}`, no arrow functions / modules / classes. Keep new code
  consistent with its neighbors rather than modernizing surrounding code.
- Inline event handlers (`onclick="..."`) are the established pattern.
- Keep CSS in the single `<style>` block; theming uses CSS custom properties
  with a `body.light` override — reuse the existing `--vars`.
- Use `safeConfirm()` instead of raw `confirm()` (it handles sandboxed iframes).

## Safety / gotchas

- **Never commit or print secrets.** API keys and GitHub tokens live only in the
  user's `localStorage`.
- **Preserve backward compatibility** of `localStorage` data and the composite
  key formats — real user data depends on it. Add migrations, don't break loads.
- After editing, bump `APP_VERSION` so the update banner / cache busting behaves.
- There are no automated tests; verify changes by loading the app in a browser
  and exercising the affected tab (Entry / Summary / Hours / Projects) plus a
  week-navigation round-trip.

## Git / workflow

- Do not create branches, commit, or push unless asked. Do not open a PR unless
  the user explicitly requests one.
- Keep changes minimal and scoped; this is a personal tool where data integrity
  matters more than refactors.
