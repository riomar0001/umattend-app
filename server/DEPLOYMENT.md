# Deploying UMAttend API

Two fully separate environments, selected by Wrangler's `--env` flag:

|                | Staging                         | Production                |
| -------------- | ------------------------------- | ------------------------- |
| Worker         | `umattend-api-staging`          | `umattend-api`            |
| D1 database    | `umattend-staging`              | `umattend`                |
| Email queue    | `umattend-email-staging`        | `umattend-email`          |
| Status queue   | `umattend-event-status-staging` | `umattend-event-status`   |
| Dead letter    | `umattend-dlq-staging`          | `umattend-dlq`            |
| Wrangler flag  | `--env staging`                 | `--env=""`                |

> **`--env=""` is not a typo.** `wrangler.jsonc` defines a named environment, so
> a bare `wrangler deploy` refuses to guess and warns. The empty string means
> "the top-level environment", i.e. production. Every npm script below already
> passes the right flag.

Durable Objects (`EPHEMERAL_STORE`, `RATE_LIMITER`) are scoped per Worker, so
the two environments get their own instances automatically — nothing to create.

---

## One-time setup

Do this once per environment. `wrangler login` first.

> Commands are given for **bash** and **PowerShell** where the two differ.
> Anything shown once works unchanged in both. PowerShell 7+ is assumed — it
> supports `&&`, which Windows PowerShell 5.1 does not; there, run the two
> halves of a chained command on separate lines.

### 1. Create the databases

```bash
wrangler d1 create umattend            # production
wrangler d1 create umattend-staging    # staging
```

Each prints a `database_id`. Paste them into `wrangler.jsonc`:

- production → the `database_id` under the top-level `d1_databases`
- staging → the `database_id` under `env.staging.d1_databases`

**These two ids must differ.** `database_id` is what actually binds the
database; `database_name` is only a label. If both entries carry the same id,
staging reads and writes production data while looking correctly configured.

### 2. Create the queues

bash:

```bash
for Q in umattend-email umattend-event-status umattend-dlq \
         umattend-email-staging umattend-event-status-staging umattend-dlq-staging; do
  wrangler queues create "$Q"
done
```

PowerShell:

```powershell
$queues = @(
  'umattend-email', 'umattend-event-status', 'umattend-dlq',
  'umattend-email-staging', 'umattend-event-status-staging', 'umattend-dlq-staging'
)
foreach ($q in $queues) { npx wrangler queues create $q }
```

Then attach an HTTP pull consumer to each dead-letter queue, so the admin panel
can read it:

```bash
wrangler queues consumer http add umattend-dlq \
  --batch-size 100 --message-retries 100 --visibility-timeout-secs 30
wrangler queues consumer http add umattend-dlq-staging \
  --batch-size 100 --message-retries 100 --visibility-timeout-secs 30
```

Three things about this step are easy to get wrong:

- **It is not in `wrangler.jsonc` and cannot be.** The config schema accepts
  only `type: "worker"` for a consumer, so pull consumers exist purely as
  account state. `wrangler deploy` will not recreate them, and nothing in the
  repo will tell you they are missing — the admin page just errors.
- **A queue gets exactly one consumer.** This works for the DLQs because they
  have none. `umattend-email` and `umattend-event-status` already have Worker
  consumers, which is why their depth and contents can never be read.
- **`--message-retries` has to be generous.** Every pull counts as a delivery
  attempt, including the ones the admin page makes just to display the list, and
  a message that exceeds the budget is dropped. 100 is high enough that browsing
  cannot destroy anything.

Raise dead-letter retention too — it defaults to 24 hours, which will silently
discard failures over a weekend. 14 days (1209600s) is the maximum:

```bash
for ID in $(wrangler queues list --json | jq -r '.[] | select(.queue_name | test("dlq")) | .queue_id'); do
  curl -X PATCH "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/queues/$ID" \
    -H "Authorization: Bearer $CF_API_TOKEN" -H 'Content-Type: application/json' \
    -d '{"settings":{"message_retention_period":1209600}}'
done
```

### 3. Apply the schema

```bash
npm run prisma:generate
npm run db:migrate:staging
npm run db:migrate:prod
```

### 4. Review the non-secret configuration

Configuration is split in two, so that the difference between environments is
reviewable in a diff rather than hidden in a dashboard.

**Non-secret values live in `wrangler.jsonc`** and are already filled in — the
top-level `vars` block is production, `env.staging.vars` is staging. That
covers `NODE_ENV`, the URLs and CORS origins, token TTLs, `GOOGLE_CLIENT_ID`,
and the Gmail host/port/from settings. Change them by editing the file and
redeploying.

> Named environments **do not inherit** the top-level `vars`. Each block must
> be complete on its own; anything missing is absent at runtime and `getEnv()`
> throws on boot.

What already differs between the two blocks is tabulated at the end of step 6.

### 5. First deploy (creates the Workers)

Secrets attach to a Worker that already exists, so deploy once before setting
them. `wrangler secret put` otherwise fails with *"If this is a new Worker, run
`wrangler deploy` first to create it"*.

```bash
npm run deploy:staging
npm run deploy:prod
```

Both Workers will be live but not yet functional — without the `JWT_*` secrets,
`GOOGLE_CLIENT_SECRET` and `MAIL_PASS` the app throws on boot. Expected at this
point; step 6 fixes it.

### 6. Upload the secrets

**Only these seven are secrets.** Run them one at a time — each command prompts
for the value, waits for you to paste it, and confirms before moving on. The
syntax is identical in bash and PowerShell.

Secrets take effect immediately; no redeploy is needed afterwards.

**Staging:**

```bash
npx wrangler secret put JWT_ACCESS_TOKEN_SECRET --env staging
npx wrangler secret put JWT_REFRESH_TOKEN_SECRET --env staging
npx wrangler secret put JWT_GOOGLE_STATE_SECRET --env staging
npx wrangler secret put JWT_ATTENDANCE_TOKEN_SECRET --env staging
npx wrangler secret put GOOGLE_CLIENT_SECRET --env staging
npx wrangler secret put MAIL_PASS --env staging
npx wrangler secret put CF_API_TOKEN --env staging
```

**Production:**

```bash
npx wrangler secret put JWT_ACCESS_TOKEN_SECRET --env=""
npx wrangler secret put JWT_REFRESH_TOKEN_SECRET --env=""
npx wrangler secret put JWT_GOOGLE_STATE_SECRET --env=""
npx wrangler secret put JWT_ATTENDANCE_TOKEN_SECRET --env=""
npx wrangler secret put GOOGLE_CLIENT_SECRET --env=""
npx wrangler secret put MAIL_PASS --env=""
npx wrangler secret put CF_API_TOKEN --env=""
```

`CF_API_TOKEN` is a Cloudflare API token with **Queues Read *and* Write** on
this account, used to read the dead-letter queue from the admin panel. Write is
not optional: a pull consumer mutates queue state in order to acknowledge, so a
read-only token cannot even list messages. Create one at
<https://dash.cloudflare.com/profile/api-tokens>. Without it the app runs
normally and only `/admin/queues` fails — the value is read lazily, per request.

Check what landed where — the values are write-only, so only names are listed:

```bash
npx wrangler secret list --env staging
npx wrangler secret list --env=""
```

> `--env=""` works as written in PowerShell too: the quotes are stripped before
> Wrangler sees the argument, leaving an empty value, which selects the
> top-level (production) environment. Verified against both environments.

Use **different JWT secrets per environment** — a staging token must not be
valid in production. `MAIL_PASS` is a 16-character Google App Password, not the
account password.

What already differs between the two `vars` blocks:

|                       | Staging                                                     | Production                                          |
| --------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| `API_URL`             | `https://staging.umattend.site`                              | `https://umattend.site`                             |
| `FRONTEND_URL`        | `https://staging.umattend.site`                              | `https://umattend.site`                             |
| `ALLOWED_ORIGINS`     | `https://staging.umattend.site`                              | `https://umattend.site,https://www.umattend.site`   |
| `GOOGLE_REDIRECT_URI` | `https://staging.umattend.site/api/v1/auth/google/callback`  | `https://umattend.site/api/v1/auth/google/callback` |
| `MAIL_FROM_NAME`      | `UMAttend (Staging)`                                         | `UMAttend`                                          |
| `EMAIL_QUEUE_NAME`    | `umattend-email-staging`                                     | `umattend-email`                                    |
| `EVENT_STATUS_QUEUE_NAME` | `umattend-event-status-staging`                          | `umattend-event-status`                             |
| `DLQ_NAME`            | `umattend-dlq-staging`                                       | `umattend-dlq`                                      |

Both redirect URIs must also be listed in Google Cloud Console → Credentials →
your OAuth client → **Authorised redirect URIs**, byte-identical.

### 7. Route the domain to the Worker

Add a Workers route so `umattend.site/api/*` reaches the Worker at the edge
(Cloudflare dashboard → Workers → your Worker → Settings → Domains & Routes).
Without this, `https://umattend.site/api/...` still resolves to the old nginx
box and OAuth callbacks never arrive.

Do the same for `staging.umattend.site/api/*` against `umattend-api-staging`.

---

## Routine deploys

CI does this automatically — pushing to `staging` or `main` runs
`.github/workflows/deploy-staging.yml` / `deploy-production.yml`, which apply
migrations and then deploy. Those workflows need two repository secrets:
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

To deploy by hand:

```bash
# staging
npm run db:migrate:staging
npm run deploy:staging

# production
npm run db:migrate:prod
npm run deploy:prod
```

Always apply migrations **before** deploying, so the new code never meets an
old schema.

### Verifying

The `npm run` commands above and below are identical in both shells.

bash:

```bash
curl https://staging.umattend.site/api/v1/health
curl https://umattend.site/api/v1/health

npm run tail:staging     # live logs
npm run tail:prod
```

PowerShell:

```powershell
irm https://staging.umattend.site/api/v1/health
irm https://umattend.site/api/v1/health

npm run tail:staging     # live logs
npm run tail:prod
```

> `irm` (`Invoke-RestMethod`) parses the JSON response into an object. On
> PowerShell 7 `curl` is *not* an alias and resolves to the real
> `C:\Windows\System32\curl.exe`, so the bash form works there too — but on
> Windows PowerShell 5.1 `curl` is aliased to `Invoke-WebRequest` and the flags
> differ, which is why `irm` is the portable choice.

---

## Changing the schema

Migrations are plain SQL under `migrations/`, shared by both environments and
applied by Wrangler rather than `prisma migrate deploy`.

```bash
npm run db:migrate:new -- add_something   # creates migrations/NNNN_add_something.sql
npm run db:migrate:diff                   # prints the SQL — paste it into that file
npm run db:migrate:local                  # try it locally first
npm run db:migrate:staging                # then staging
npm run db:migrate:prod                   # then production
```

`db:migrate:diff` compares against your **local** D1 replica, so run
`db:migrate:local` before diffing again or the next diff will repeat itself.

### Inspecting data

Identical in both shells — quote the SQL so the spaces survive:

```bash
npm run db:studio:staging "SELECT count(*) FROM events;"
npm run db:studio:prod    "SELECT count(*) FROM events;"
```

Both `npm run <script> "SQL"` and `npm run <script> -- "SQL"` pass the argument
through correctly.

---

## Rolling back

```bash
wrangler rollback --env=""          # production, previous version
wrangler rollback --env staging
wrangler deployments list --env=""  # pick a specific version id
```

Rollback only reverts the Worker code, never the database. A migration that
drops or rewrites a column cannot be undone this way — write migrations to be
backward-compatible with the previous deploy (add columns, don't rename them in
the same release).

---

## Operational notes

**Queue backlog.** Failed messages retry with backoff, then land in the DLQ:

```bash
wrangler queues consumer list umattend-email
wrangler queues list
```

Inspect the DLQ from the admin panel (`/admin/queues`), which reads it through
the pull consumer attached in setup step 2. From there a job can be re-queued
onto its original queue or discarded.

Two limits are worth knowing before you go looking:

- **Some jobs show no reason, and that is meaningful.** On its final attempt a
  consumer dead-letters itself, attaching the error, origin queue and real
  attempt count (`src/worker/deadLetter.ts`). Cloudflare's own dead-lettering
  copies the body verbatim with none of that, so a job showing *"Not recorded"*
  did not fail in a `catch` block — it was a CPU timeout, an isolate crash, or a
  throw before the handler's `try`. Go to Workers logs for those
  (`observability.logs` is on at 100% sampling) and correlate by timestamp.
  The distinction is worth reading as a signal, not a gap.
- **Listing is not free.** Each pull counts as a delivery attempt against the
  consumer's retry budget, which is why the admin page refreshes only when asked
  rather than on a timer. Do not add polling to it.

`wrangler queues list` reports `producers: 0` for both DLQs. That is expected:
dead-lettering is internal platform routing, not a producer binding, so the
source queues never appear as producers and the dashboard bindings graph cannot
draw the edge either. To confirm dead-lettering is actually configured, check
the consumer instead:

```bash
curl -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/queues/$QUEUE_ID/consumers"
```

and look for `dead_letter_queue` in the response.

**Cron triggers** (`0 */12 * * *` token cleanup, `*/15 * * * *` event status
reconciliation) fire only on deployed Workers, not in `wrangler dev`. Trigger
one locally with:

```bash
curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*"
```

PowerShell:

```powershell
irm "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*"
```

The URL must stay quoted in both shells — unquoted, `*` and `?` are expanded as
wildcards before the request is made.

**No data migration from Supabase.** D1 starts empty. Moving existing Postgres
rows into SQLite is a separate exercise and has not been done.

**Gmail sending limits** apply if `MAIL_HOST=smtp.gmail.com`: roughly 500
messages/day on a consumer account, 2,000 on Workspace. Check-in and check-out
emails are one message per scan, so a large event can exhaust that quickly.
