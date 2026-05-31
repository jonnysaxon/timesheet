# Suggested Improvements

Notes captured while documenting the Weekly Timesheet app. None are blocking —
the app works as-is — but each would make it more robust or easier to maintain.
Roughly ordered by effort-to-value.

## Quick wins

### 1. Consolidate the two HTML files
`index.html` and `timesheet.html` are two near-identical copies of the app.
Keeping both means edits can silently drift between them.
- **Action:** pick `index.html` as the single entry point; delete
  `timesheet.html` or move it to an `archive/` folder with a note.

### 2. Add a `.gitignore`
There's no `.gitignore` today, so OS/editor cruft (`.DS_Store`, `.vscode/`,
`*.swp`) can be committed by accident.
- **Action:** add a small `.gitignore` covering common editor/OS files.

### 3. Add a `LICENSE`
No license file is present, so reuse terms are undefined.
- **Action:** add a `LICENSE` (e.g. MIT for permissive, or keep it private/
  all-rights-reserved) to make intent explicit.

### 4. Make the AI model configurable
The Anthropic call hard-codes the model in `expandWithAI()`
(`index.html`, currently `model:'claude-sonnet-4-20250514'`).
- **Action:** expose it as a setting (or a single top-of-file constant) so the
  model can be updated without hunting through the code.

## Medium effort

### 5. Add a web app manifest + icons
The app behaves like a PWA (service worker, "Add to Home Screen") but ships no
`manifest.json`, so installs use default naming and icons.
- **Action:** add `manifest.json` (name, theme color, icons) and link it from
  `index.html`. Provide at least 192px and 512px icons.

### 6. Pre-cache static assets in the service worker
`sw.js` is network-first for navigation only; offline use depends on the
browser's HTTP cache for `index.html` and CDN assets.
- **Action:** pre-cache `index.html`, `sw.js`, and the CDN scripts/fonts during
  the service worker `install` step so offline behavior is deterministic.
- **Note:** the SheetJS and IBM Plex font dependencies load from CDNs, so true
  offline support means caching (or vendoring) those too.

### 7. Surface a non-blocking confirm in sandboxed frames
`safeConfirm()` auto-returns `true` inside iframes (e.g. the Claude preview) so
destructive actions aren't silently blocked — but that means **no** confirmation
in those contexts.
- **Action:** consider a lightweight in-app confirm modal for destructive
  actions (Clear Week, Delete Project) instead of relying on native `confirm()`.

## Larger / design-level

### 8. GitHub sync conflict handling
`ghPush()` / `ghPullNow()` are last-write-wins. Two devices editing the same
week can silently overwrite each other.
- **Action:** compare timestamps (or the stored SHA) before pushing and warn /
  merge when the remote is newer than the last known sync.

### 9. Reduce inline `style="..."` usage
Much of the markup uses inline styles. Moving these into the existing
`<style>` block / CSS classes would improve consistency and make theming easier.

---

## Already handled well (for reference)

These are existing strengths worth preserving when making changes above:

- User text is escaped via `esc()` before `innerHTML` (XSS-safe rendering).
- `localStorage` data has explicit migrations (`migrateV4`,
  `migrateWeekKeysToLocal`, `repairWeekJobs`) — keep these intact.
- Secrets (API key, GitHub token) stay on-device and are masked in the UI.
- GitHub sync warns if the target repo is public.
