# Suggested Improvements

Notes captured while documenting the Weekly Timesheet app. None are blocking —
the app works as-is — but each would make it more robust or easier to maintain.
Roughly ordered by effort-to-value.

**Status:** items 2, 4, 6, 7, 8, and 9 were implemented in `v1.3.0` and are
marked ✅ Done below. Items 1, 3, and 5 remain open.

**`v1.3.1`** — versioning hardening: removed the duplicated `APP_VERSION`
literal so `version.txt` is the single source of truth (read at runtime). This
eliminates the class of bug where `version.txt` and the in-code version drifted
out of sync and misfired the update banner. The service worker now serves
`version.txt` network-first so the update signal is never stale, and update
detection runs independently of service-worker registration.

## Quick wins

### 1. Consolidate the two HTML files
`index.html` and `timesheet.html` are two near-identical copies of the app.
Keeping both means edits can silently drift between them.
- **Action:** pick `index.html` as the single entry point; delete
  `timesheet.html` or move it to an `archive/` folder with a note.

### 2. Add a `.gitignore` — ✅ Done (v1.3.0)
There's no `.gitignore` today, so OS/editor cruft (`.DS_Store`, `.vscode/`,
`*.swp`) can be committed by accident.
- **Action:** add a small `.gitignore` covering common editor/OS files.
- **Done:** added `.gitignore` covering OS files, editor/IDE folders, logs/temp,
  and local data exports (`timesheet_backup_*.json`, `timesheet-data.json`) so
  personal timesheet data is never committed by accident.

### 3. Consider a `LICENSE` (optional)
This is **optional** and only worth doing if you want to allow others to reuse
the code — for a purely personal tool, leaving it off is a perfectly reasonable
default.

Why it comes up: the repo is public but has no `LICENSE` file. Under default
copyright law, "no license" does **not** mean "free to use" — it means the
opposite: **all rights reserved**. Anyone can *view* the code, but no one may
legally copy, modify, or fork it without explicit permission.

- If you want that (all rights reserved): do nothing — the current state already
  achieves it.
- If you want others to be able to reuse it: add a `LICENSE` (e.g. MIT for
  permissive use) to grant that permission explicitly.

### 4. Make the AI model configurable — ✅ Done (v1.3.0)
The Anthropic call hard-codes the model in `expandWithAI()`
(`index.html`, currently `model:'claude-sonnet-4-20250514'`).
- **Action:** expose it as a setting (or a single top-of-file constant) so the
  model can be updated without hunting through the code.
- **Done:** added a `DEFAULT_AI_MODEL` constant near the top of the script and an
  optional **AI Model** field in Settings (`state.settings.aiModel`).
  `expandWithAI()` now uses `state.settings.aiModel || DEFAULT_AI_MODEL`, so the
  model can be changed per-device in the UI, with the constant as the fallback.

## Medium effort

### 5. Add a web app manifest + icons
The app behaves like a PWA (service worker, "Add to Home Screen") but ships no
`manifest.json`, so installs use default naming and icons.
- **Action:** add `manifest.json` (name, theme color, icons) and link it from
  `index.html`. Provide at least 192px and 512px icons.

### 6. Pre-cache static assets in the service worker — ✅ Done (v1.3.0)

**Done:** `sw.js` now pre-caches the app shell (`./`, `index.html`, `sw.js`,
`version.txt`) at install via `cache.addAll`, plus a best-effort attempt at the
SheetJS CDN script (ignored if offline at install; still cached on first
successful load by the existing fetch handler). `CACHE_VERSION` was bumped to
`timesheet-v2`, with a comment reminding maintainers to bump it in step with
`APP_VERSION` so a published update reliably replaces the pre-cached copy.

**What this is about.** A "service worker" (`sw.js`) is a small script the
browser keeps running in the background. Its main job here is to let the app
keep working when you have no internet — for example, opening the timesheet on
a phone in airplane mode. To do that, it needs a saved copy ("cache") of the
files the app is built from.

**The current situation.** Right now `sw.js` only deliberately saves a copy of
the page *after* you've successfully loaded it online (this is the "network
first" approach — try the internet, fall back to a saved copy). It does not
proactively save everything up front. It also doesn't control the two files
loaded from external servers (CDNs): the **SheetJS** library (used for Excel
export) and the **IBM Plex fonts**. Those rely on the browser's own ordinary
cache, which the browser can clear at any time.

**What "fixing" it means.** Change the service worker so that the first time the
app runs, it explicitly downloads and stores `index.html`, `sw.js`, and ideally
the CDN files too — so the full app is guaranteed to be available offline.

**Benefits of doing it:**
- Reliable offline use: the app opens and works even with no connection, every
  time, not just "usually."
- Faster startup, since files load from local storage instead of the network.
- Excel export and correct fonts keep working offline (only if the CDN files are
  cached or bundled into the repo).

**Disadvantages / costs:**
- More complexity in `sw.js`, and a new thing to get wrong: if you cache files
  but forget to refresh the cache when you publish a new version, users can get
  **stuck on an old version**. (The app already has an update banner and
  `APP_VERSION` check to mitigate this, but caching makes that machinery more
  important to get right.)
- Caching the CDN files means either trusting the cross-origin response or
  **vendoring** them (copying SheetJS and the fonts into the repo), which adds
  files to maintain and update.
- For everyday use on a device that's usually online, the practical benefit is
  small — this mostly matters if genuine offline use is a real requirement.

**Bottom line:** worth doing only if reliable offline use actually matters to
you. If the app is essentially always used online, the current behavior is fine.

### 7. Surface a non-blocking confirm in sandboxed frames — ✅ Done (v1.3.0)

**Done:** replaced the old `safeConfirm()` (which auto-assumed "yes" in iframes)
with a promise-based in-app `appConfirm()` modal and a `#confirmModal` dialog
that works in every context. All destructive actions now await it
(`clearWeek`, `deleteJobThisWeek`, `closeProject`, `deleteProjectPermanently`,
`rollbackAI`, `clearSensitive`, and backup restore). The dialog supports custom
title / button text and danger styling, and Escape cancels it.

**What this is about.** Several destructive actions (Clear Week, Delete Project,
Rollback AI) ask "Are you sure?" before proceeding. They use a helper called
`safeConfirm()`, which normally shows the browser's built-in `confirm()` pop-up.

**The current situation.** The browser's native `confirm()` pop-up doesn't work
inside a "sandboxed iframe" — for example, when the app is embedded in a preview
window. In that case `confirm()` silently does nothing and reports "cancelled,"
which would block the user from ever completing the action. To avoid that,
`safeConfirm()` detects this situation and just **assumes "yes"** — it skips the
question entirely and proceeds. The trade-off: in those embedded contexts there
is **no confirmation at all**, so an accidental tap on Delete goes straight
through with no safety net.

**What "fixing" it means.** Replace the native pop-up with a small confirmation
dialog built into the app itself (using the same modal style the app already
uses for Settings and Add Project). A custom dialog works everywhere — including
sandboxed iframes — so you get a real "Are you sure?" in every context.

**Benefits of doing it:**
- Consistent safety: destructive actions are always confirmed, even in embedded
  previews, removing the "accidental delete with no warning" gap.
- Visual consistency: the confirm dialog matches the app's look instead of the
  browser's plain grey system pop-up.
- More control: you can word the warning clearly and style dangerous buttons in
  red.

**Disadvantages / costs:**
- More code: a custom modal needs its own markup, styling, and a small amount of
  asynchronous wiring (the current `confirm()` is a single blocking line; a
  custom dialog has to wait for the user's click via a callback or promise),
  which touches every destructive action.
- The risk it addresses is narrow: it only matters when the app runs inside a
  sandboxed iframe. In a normal browser tab or installed on a phone, the
  existing native `confirm()` already works fine.

**Bottom line:** a nice polish and a genuine safety improvement for embedded use,
but low priority if the app is normally used as a standalone page or installed
app, where confirmations already work.

## Larger / design-level

### 8. GitHub sync conflict handling — ✅ Done (v1.3.0)
`ghPush()` / `ghPullNow()` are last-write-wins. Two devices editing the same
week can silently overwrite each other.
- **Action:** compare timestamps (or the stored SHA) before pushing and warn /
  merge when the remote is newer than the last known sync.
- **Done:** `ghPush()` now compares the remote SHA against `ghLastSha` (the SHA
  our local state is based on) before overwriting. If the remote has moved since
  our last sync it throws a conflict instead of clobbering. `ghPushNow()` catches
  that and asks the user via `appConfirm` whether to **Overwrite GitHub**
  (force push) or **Pull instead**. A first-ever push (`ghLastSha === null`)
  never conflicts. (Still last-write-wins *after* the user's explicit choice —
  not a field-level merge, but no longer silent.)

### 9. Reduce inline `style="..."` usage — ✅ Done (v1.3.0)
Much of the markup uses inline styles. Moving these into the existing
`<style>` block / CSS classes would improve consistency and make theming easier.
- **Done:** introduced reusable classes (`.panel-header`, `.sensitive-display`,
  `.mask-text`, `.btn-mini`, `.btn-mini-danger`, `.confirm-message`) and applied
  them to the Summary/Hours/Projects panel headers and the API-key / GitHub-token
  display rows, removing the largest repeated inline-style blocks. (A full sweep
  of every remaining inline style is still possible but lower value; the
  highest-duplication cases are now done.)

---

## Already handled well (for reference)

These are existing strengths worth preserving when making changes above:

- User text is escaped via `esc()` before `innerHTML` (XSS-safe rendering).
- `localStorage` data has explicit migrations (`migrateV4`,
  `migrateWeekKeysToLocal`, `repairWeekJobs`) — keep these intact.
- Secrets (API key, GitHub token) stay on-device and are masked in the UI.
- GitHub sync warns if the target repo is public.
