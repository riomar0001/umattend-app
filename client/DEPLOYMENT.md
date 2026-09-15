# Deploying the UMAttend frontend to Vercel

Next.js 16 app in `client/`. The API is a Cloudflare Worker — see
[`../server/DEPLOYMENT.md`](../server/DEPLOYMENT.md).

## The one architectural decision

The apex domain cannot serve both. Vercel and Cloudflare Workers each need to
own a hostname, so:

| Host                        | Serves                    | Platform           |
| --------------------------- | ------------------------- | ------------------ |
| `umattend.site`             | the Next.js app           | Vercel             |
| `api.umattend.site`         | the API Worker            | Cloudflare Workers |
| `staging.umattend.site`     | the Next.js app (preview) | Vercel             |
| `api-staging.umattend.site` | the API Worker (staging)  | Cloudflare Workers |

The browser never talks to `api.umattend.site` directly. `next.config.ts`
rewrites `/api/*` to it server-side, so every request the browser makes is
same-origin against `umattend.site`. That means **no CORS preflights and no
cross-site cookie rules to get wrong** — which matters, because the API sets its
cookies `SameSite=Strict` and they would be dropped on a genuine cross-site
request.

This replaces the earlier plan of routing `umattend.site/api/*` to the Worker
from Cloudflare; Vercel now owns that path and forwards it.

---

## 1. Point the Worker at its own hostname

In the Cloudflare dashboard → Workers → `umattend-api` → Settings → Domains &
Routes, add a **Custom Domain** of `api.umattend.site`. Do the same for
`umattend-api-staging` with `api-staging.umattend.site`. Cloudflare creates the
DNS records itself.

> **Turn off Cloudflare Access for these hostnames.** Adding a custom domain can
> leave it behind an Access policy, which answers every request with a `302` to
> `<team>.cloudflareaccess.com/cdn-cgi/access/login/...`. The Vercel edge cannot
> sign in, so the proxy just forwards a login page. Remove it under
> **Zero Trust → Access → Applications**, deleting the application covering
> `api*.umattend.site`. The API already authenticates with its own JWTs. Verify
> with `curl -I https://api.umattend.site/api/v1/health` — a `302` to
> `cloudflareaccess.com` means it is still on.

Then update the Worker's config so OAuth and CORS agree with the new layout —
in `server/wrangler.jsonc`, both `vars` blocks:

```jsonc
// production
"API_URL": "https://api.umattend.site",
"GOOGLE_REDIRECT_URI": "https://umattend.site/api/v1/auth/google/callback",
"ALLOWED_ORIGINS": "https://umattend.site,https://www.umattend.site",
```

`GOOGLE_REDIRECT_URI` deliberately stays on the frontend host: Google redirects
the browser to `umattend.site/api/v1/auth/google/callback`, Vercel proxies it to
the Worker, and the Worker's redirect back to `FRONTEND_URL` passes through. One
domain in Google Console, no extra entry needed.

Redeploy the Worker after editing (`npm run deploy:prod` in `server/`).

## 2. Create the Vercel project

```bash
npm i -g vercel
cd client
vercel link
```

Or via the dashboard: **Add New → Project → import the repo**.

**Set Root Directory to `client`.** This is the one setting that is not
auto-detected correctly in this repo — without it Vercel builds from the
repository root and finds no Next.js app. Framework preset, build command and
output directory are all detected automatically.

## 3. Environment variables

Add these under Settings → Environment Variables (or `vercel env add`):

| Variable              | Value                               |
| --------------------- | ----------------------------------- |
| `NEXT_PUBLIC_API_URL` | `/api/v1`                           |
| `API_ORIGIN`          | the API Worker origin for that host |

`NEXT_PUBLIC_API_URL` stays **relative** on purpose — that is what keeps traffic
same-origin and routed through the proxy. `API_ORIGIN` is the proxy's
destination and is server-only, so it never reaches the browser.

> **Match the Vercel environment, not the name of the site.** Vercel's
> "Production" environment is whatever the project's production branch deploys,
> which in this repo is `dev` serving `staging.umattend.site`. So the staging
> site reads **Production**-scoped variables, and `API_ORIGIN` must be set there
> as `https://api-staging.umattend.site` — putting it under Preview has no
> effect on it. Check the deployment's `Environment:` field if unsure.

> **Both are build-time values.** `NEXT_PUBLIC_*` is inlined into the bundle,
> and `rewrites()` is evaluated during `next build` and baked into the routes
> manifest. Changing either requires a **redeploy** — a restart will not pick it
> up.

If `API_ORIGIN` is missing the build now fails with an explicit message, rather
than deploying an app whose every `/api` call 404s.

## 4. Deploy

```bash
vercel          # preview deployment
vercel --prod   # production
```

Pushing to the repo deploys automatically once the project is linked: the
production branch goes live, every other branch gets a preview URL.

## 5. Attach the domains

Settings → Domains → add `umattend.site` and `www.umattend.site`.

DNS for this zone is on Cloudflare, so add the records Vercel shows you there
and set them to **DNS only (grey cloud)**. Leaving Cloudflare's proxy on puts
its CDN in front of Vercel's, which breaks certificate issuance and can serve
stale builds. `api.umattend.site` is unaffected — it stays proxied, because it
*is* Cloudflare.

---

## Verifying

```bash
curl -I https://umattend.site                       # Vercel
curl    https://umattend.site/api/v1/health         # proxied to the Worker
curl    https://api.umattend.site/api/v1/health     # the Worker directly
```

All three should succeed. Reading the failures:

| Symptom                                                  | Cause                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| Proxied call 404s, direct call works                      | `API_ORIGIN` absent for the built environment — set it and redeploy  |
| Direct call 302s to `cloudflareaccess.com`                | Cloudflare Access still guards the hostname (see step 1)             |
| Proxied call returns an HTML sign-in page                 | same — the proxy is faithfully forwarding Access's login page        |
| `/api/v1/...` resolves to `/api/v1/api/v1/...`            | `API_ORIGIN` set to a relative path; it must be an absolute origin   |

## Notes

**`output: 'standalone'`** is now applied only when `VERCEL` is unset, so the
Docker image in `client/Dockerfile` still builds while Vercel uses its own
output format.

**Token refresh was broken before this change.** `src/lib/axios.ts` builds the
refresh URL as `${NEXT_PUBLIC_API_URL}/auth/refresh`, but the previous Docker
config set `NEXT_PUBLIC_API_URL=https://umattend.site`, producing
`https://umattend.site/auth/refresh` — a 404, since the route lives at
`/api/v1/auth/refresh`. Setting the variable to `/api/v1` fixes it.

**The `packageManager: pnpm` field was removed** from `package.json`. It
disagreed with the committed `package-lock.json` (no `pnpm-lock.yaml` exists),
and Vercel honours that field — the build would have failed on
`pnpm install --frozen-lockfile`. The rest of the repo, including CI, uses npm.
If you would rather standardise on pnpm, commit a `pnpm-lock.yaml`, delete
`package-lock.json`, and update `.github/workflows/` accordingly.

**The client is still listed in `docker-compose.*.yml`** behind nginx. Once
Vercel serves the frontend, that service and the nginx `location /` block are
redundant — worth removing in a follow-up, but nothing breaks if they stay.
