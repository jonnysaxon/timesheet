# Azure Backend Architecture (Future Option)

**Status: Proposed — deferred.** Not implemented, and nothing in the current app
depends on it. This document preserves the design from an external architecture
review (5 July 2026) so it can be picked up later without re-deriving it. Do not
build any of this unless explicitly asked.

**Decision to date (v1.7.2):** instead of migrating, the app kept its
zero-backend architecture and fixed the review's central security finding
directly — `ghPush()` now strips `ghToken`/`apiKey` from the synced
`timesheet-data.json`, and the app requests `navigator.storage.persist()` at
startup to reduce eviction risk. Multi-device use already works today (enter
keys once per device; GitHub sync carries the data). This migration becomes
worth revisiting if sign-in-based recovery — no per-device key entry at all —
ever justifies running a backend.

---

## The idea in one paragraph

Move the hosted PWA from GitHub Pages to **Azure Static Web Apps (Free plan)**
and add a small set of **managed Azure Functions** under the same origin
(`/api/*`). The browser stops calling the GitHub Contents API and Anthropic API
directly; instead it calls `/api/timesheet` and `/api/ai/*`, and the Functions
attach the credentials server-side from encrypted Azure application settings.
GitHub remains both the source-code repo and the private data repo
(`timesheet-data.json` stays the durable system of record). Sign-in uses Azure
Static Web Apps' built-in GitHub/Microsoft auth, restricted to a custom `owner`
role assigned only to the app's owner.

---

## Pros and cons

### Pros

- **No per-device credentials.** New laptop or reinstalled phone = open the URL
  and sign in with GitHub. No token/API-key pasting, no password-manager
  dependency for setup.
- **Storage wipe becomes a non-event.** Recovery is sign in → app pulls from
  GitHub → done. Today a wipe means re-entering both keys before pulling.
- **Secrets leave the browser entirely.** The GitHub token and Anthropic key
  live only in Azure application settings (encrypted at rest, server-only). No
  script running in the page can ever read them; nothing sensitive sits in
  `localStorage`.
- **Server-enforced AI cost controls.** Model allowlist, output-token caps, and
  input-size caps are enforced where the key lives, not trusted to client code.
- **Stricter security posture is possible.** With direct GitHub/Anthropic calls
  gone, `connect-src` can be tightened to essentially `'self'`; the backend can
  validate/allowlist what gets written to the data repo (e.g. reject secret-like
  fields) and verify the data repo is still private.
- **Still free.** Azure Static Web Apps Free covers this workload comfortably
  (100 GB bandwidth/month, managed Functions included). Anthropic usage remains
  the only real cost, same as today.
- **GitHub data model unchanged.** Same JSON file, same commit history, same
  SHA-based conflict handling — just moved behind the API.

### Cons

- **A backend to build and maintain.** The app goes from one HTML file with
  zero infrastructure to frontend + Node Functions + `staticwebapp.config.json`
  + auth roles + a deployment workflow + Azure portal settings. It permanently
  loses the "open the file and it runs" property this repo is built around.
- **Periodic re-sign-in on the iPhone.** Azure auth is a session cookie that
  expires. The installed PWA that today never asks for anything will
  occasionally bounce through a GitHub OAuth redirect — and OAuth redirects
  inside installed iOS PWAs are historically flaky.
- **45-second managed-function cap.** Long AI Review generations (6–12 month
  ranges) must complete within Azure's managed API duration limit or fail. Needs
  testing before cutover; the contingency is moving just the AI proxy to another
  serverless host (e.g. Cloudflare Workers).
- **New origin = new PWA.** The Azure app is a separate install with separate
  storage; migration requires a careful cutover (old and new apps coexist until
  the new one proves a round-trip) and the old GitHub Pages install retired.
- **Key management moves, it doesn't vanish.** The fine-grained GitHub token
  still expires and still needs rotating — just in Azure settings instead of the
  app. Plus a new class of admin: Azure resource, role invitations, deployment
  credentials.
- **Unsynced local edits are no safer.** Anything typed while offline and not
  yet synced is still lost if storage is wiped — same as today.
- **Auth pitfall to get right.** Any GitHub user can authenticate against an
  SWA app; the built-in `authenticated` role is NOT sufficient. Access must be
  restricted to a custom `owner` role granted by invitation, with the Functions
  re-validating the `x-ms-client-principal` header as defence in depth.
- **Offline-first gets more delicate.** The service worker must exclude
  `/api/*` and `/.auth/*` from caching or it will serve stale/private API
  responses from the app-shell cache.

**Net:** the migration trades one-time-per-device key entry (rare, minutes) for
recurring sign-ins plus a permanently more complex system. It becomes the right
call if key handling ever feels burdensome, if more devices/users appear, or if
the security bar rises.

---

## Target architecture

```text
                     GitHub app repository (source + deploy workflow)
                                   |
                                   | GitHub Actions
                                   v
+------------------------------------------------------------------+
| Azure Static Web Apps (Free)     https://<app>.azurestaticapps.net|
|                                                                  |
|  Static frontend: PWA shell, offline cache, local editable state |
|  Auth: GitHub or Microsoft sign-in, custom role "owner"          |
|  Managed Azure Functions:                                        |
|    GET/PUT /api/timesheet      POST /api/ai/expand               |
|    GET     /api/health         POST /api/ai/review               |
|  Server-only app settings:                                       |
|    GITHUB_TOKEN, GITHUB_REPO, GITHUB_DATA_PATH,                  |
|    ANTHROPIC_API_KEY, ALLOWED_AI_MODELS, MAX_* caps,             |
|    ALLOWED_USER_ID (defence in depth)                            |
+------------------------------------------------------------------+
              |                                   |
              | server-side GitHub request        | server-side AI request
              v                                   v
     Private GitHub data repo             Anthropic Messages API
     (timesheet-data.json + history)
```

Trust zones: the browser holds only cached timesheet data and a temporary auth
cookie; Azure's edge enforces route-role rules; the Functions hold the real
credentials; GitHub and Anthropic are upstream services.

## Identity and access

- Sign-in via SWA's preconfigured providers (`/.auth/login/github`,
  principal readable at `/.auth/me`).
- `staticwebapp.config.json` restricts `route: /api/*` to
  `allowedRoles: ["owner"]`. The static shell can stay public (it contains no
  secrets); on startup it checks `/.auth/me` and shows either the app or a
  sign-in screen.
- The `owner` role is granted via an SWA invitation to the one intended account
  (Free plan supports 25 invitations).
- Functions use `authLevel: anonymous` but decode `x-ms-client-principal` and
  require the `owner` role (optionally also match `ALLOWED_USER_ID`) — defence
  against route misconfiguration.

## API surface

| Method | Endpoint            | Purpose |
|--------|---------------------|---------|
| `GET`  | `/api/health`       | API up + caller authorised (booleans only, never secret values). |
| `GET`  | `/api/timesheet`    | Read `timesheet-data.json` + its GitHub SHA (`sha: null` if the file doesn't exist yet). |
| `PUT`  | `/api/timesheet`    | Validate + write with optimistic concurrency (`expectedSha`; `409 REMOTE_CHANGED` on conflict; `force: true` for explicit overwrite). |
| `POST` | `/api/ai/expand`    | Structured request (job, role, day entries) → server builds the prompt, calls Anthropic, returns the day mapping. |
| `POST` | `/api/ai/review`    | Date-range review summary; server enforces the ~80k-char input cap and output-token cap. |

Backend rules: JSON only, payload size limits, allowlist top-level fields
(never persist the raw request), reject/strip secret-like fields, allowlisted
model IDs only, `Cache-Control: no-store`, consistent
`{error, message, requestId}` error shape, and no tokens/prompts/payloads in
logs.

The existing UI's SHA-conflict behaviour (Pull vs Overwrite) transfers
one-to-one — the check just moves server-side. The UI must only mark state
clean after the backend returns the new SHA.

## Frontend and service-worker changes

- Remove the API-key and GitHub-token fields from Settings; replace with a
  "Signed in as …" section and sign-in/out controls.
- Replace `ghHeaders()`/`ghApiUrl()`/direct `api.github.com` calls with
  `/api/timesheet`; replace direct `api.anthropic.com` calls (and the
  `anthropic-dangerous-direct-browser-access` header) with `/api/ai/*`.
- `sw.js`: bypass caching for `/api/*` and `/.auth/*` (network-only) at the top
  of the fetch handler. Keep the existing app-shell pre-cache and network-first
  `version.txt` behaviour.
- Check path assumptions when leaving GitHub Pages' subpath hosting: manifest
  `start_url`/`scope`, SW registration path, icon paths. Remove the editable
  App URL setting (use `window.location.origin`).
- New origin = new PWA identity: install fresh on each device, keep the old app
  until the new one completes a verified save round-trip, then retire GitHub
  Pages with a redirect notice.

## Migration outline

1. **Protect data:** sync + JSON backup from the current app; note repo/path.
2. **Stand up Azure** alongside the old app: SWA resource, `api/` Functions,
   `staticwebapp.config.json`, **new** GitHub fine-grained token (Contents
   read/write on the data repo only) and **new/rotated** Anthropic key in app
   settings. Never put the new keys into the old browser app.
3. **Identity:** sign in, create + accept the `owner` invitation, confirm
   `/.auth/me`, optionally pin `ALLOWED_USER_ID`.
4. **Swap the frontend** to `/api/*` (per above) and deploy.
5. **Test on Windows first** (load, save → new GitHub commit, conflict test in
   a second profile, AI expand/review incl. a large range, offline), then
   install; migrate the iPhone the same way, keeping the old app temporarily.
6. **Revoke** the old browser-held GitHub token and Anthropic key, confirm the
   latest `timesheet-data.json` has no secret fields, retire GitHub Pages.

Old tokens may exist in the data repo's commit history from before v1.7.2 —
rotation (not just deletion from the latest file) is the essential control.

## Alternatives considered (from the review)

| Option | Verdict |
|--------|---------|
| GitHub Pages frontend + separate backend host | Rejected — CORS, split origins, harder auth for no benefit. |
| Cloudflare Pages + Workers | Credible fallback, esp. if the 45 s AI cap bites; single-user auth needs more custom design. |
| Vercel / Netlify | No built-in auth story; no advantage over SWA here. |
| Supabase / Firebase + database | Over-scaled; abandons the GitHub-history data model. |
| Keep keys local, move data to IndexedDB | Doesn't address credentials at all; IndexedDB is a separate, optional storage improvement. |

## Open questions to resolve before building

- Does a 6–12-month AI Review complete inside the 45-second managed-function
  limit with the current model and output caps?
- Is sending timesheet content to Anthropic via a backend still acceptable
  under employer/customer policy? (The proxy protects the key, not the data.)
- Keep the app source repo private (it would contain backend code), and disable
  PR preview environments so untrusted code can never run with production
  settings.

---

*Derived from "Architecture Review: JTS PWA Hosting, Synchronisation and Secret
Management" (5 July 2026), which recommended this design as its Option B. Key
Azure references: SWA [authentication/authorization](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization),
[Functions APIs](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions),
[application settings](https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings),
[quotas](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas).*
