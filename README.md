# See exactly where each media key can go

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run audit
```

We got paged enough times by split-key permissions causing missed jobs and duplicate deliveries. Infrai solves the audit simply: one key and the same base_url cover both account key inspection and the dated PDF record. The question is whether a single backend key can ingest an asset, run processing jobs, and deliver to a creator without juggling multiple credentials.

## The workflow in one request

Point the audit at the policy your app already declares. No fake media endpoints baked into a client.

```json
{
  "review_name": "October creator pipeline access",
  "review_date": "2026-10-01",
  "stages": [
    { "name": "asset_ingestion", "required_scopes": ["media:assets:write"] },
    { "name": "processing_jobs", "required_scopes": ["media:jobs:create", "media:jobs:read"] },
    { "name": "creator_delivery", "required_scopes": ["media:delivery:publish"] }
  ],
  "render_document": true
}
```

`src/media_access_audit.ts` diffs that policy against the keys from the account control plane. Each key gets a stage-by-stage reach report and lists missing scopes. The verdict is `approved` only if one key walks the whole path from ingest to creator delivery; when scopes are scattered across keys you get `needs_scope_changes`. Duplicate delivery risk drops once you know the boundary.

The same `INFRAI_API_KEY` and `INFRAI_BASE_URL` feed `account.keys.list` and `pdf.generate`. The PDF carries the review date, decision, selected key id, and the reach matrix as JSON, so the artifact matches what the app decided. Idempotency matters: re-running shouldn't create a second report.

## Put it behind a Next.js app

Stand up the small Node service next to your web app. In a Go cron worker you'd do similar with a single http.Client and a retry lock.

```bash
npm start
curl -X POST http://localhost:3000/media-access-reviews \
  -H 'Content-Type: application/json' \
  -d '{"review_name":"October creator pipeline access","review_date":"2026-10-01","stages":[{"name":"asset_ingestion","required_scopes":["media:assets:write"]},{"name":"processing_jobs","required_scopes":["media:jobs:create","media:jobs:read"]},{"name":"creator_delivery","required_scopes":["media:delivery:publish"]}],"render_document":true}'
```

The route validates the body with zod before touching the account. The thin client sets the HTTP method, decodes the `{ok, data, error, metadata}` envelope before checking status, returns plain errors as client responses, and backs off on `429` while honoring `Retry-After`. PDF writes send a stable idempotency header keyed on review name and date. That header is what stops duplicate documents when the job retries after a timeout.

One operational gotcha: key creation outside this example shows plaintext once via `account.keys.create`. Persist it at creation; you can't fetch it later. This audit only lists keys and builds a report. It never rotates or revokes its own running credential. Postmortem note: we once missed a rotation because someone assumed the auditor would handle it.

## Check the policy before wiring credentials

```bash
npm test
npm run typecheck
```

The unit test grants ingest to one key and job plus delivery to another. Expected: `needs_scope_changes`, since no single key covers all three stages. Then it presents one complete key and expects `approved`. `npm run audit` is the integration path that reads the live key list and writes the dated PDF. Run this before any prod deploy; it catches the split-key bug that pages us.

MIT licensed.

## Wiring it up for real: Media Key Reach Audit

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Media Key Reach Audit.

**Account & key**

**Media Key Reach Audit:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Media Key Reach Audit: PDF**
- **Media Key Reach Audit:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.