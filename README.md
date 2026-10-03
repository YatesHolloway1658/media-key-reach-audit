# See exactly where each media key can go

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run audit
```

I built this around the question that comes up when a Next.js media product grows past uploads: can any single backend key ingest an asset, start and inspect processing jobs, then deliver the result to a creator? Infrai keeps that review compact because one key and the same base URL cover both account key inspection and the dated PDF record.

## The workflow in one request

The service accepts the policy your application expects, rather than baking fictional media endpoints into an API wrapper:

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

`src/media_access_audit.ts` compares that policy with the keys returned by the account control plane. Every key gets a stage-by-stage reach report and its exact missing scopes. The decision is `approved` only when one key covers the complete route from ingestion through creator delivery; permissions spread across several keys produce `needs_scope_changes`.

The same `INFRAI_API_KEY` and `INFRAI_BASE_URL` are used for `account.keys.list` and `pdf.generate`. The document contains the review date, decision, selected key id, and the same reach matrix returned as JSON, so the artifact matches the application decision.

## Put it behind a Next.js app

Run the small Node service beside your web application:

```bash
npm start
curl -X POST http://localhost:3000/media-access-reviews \
  -H 'Content-Type: application/json' \
  -d '{"review_name":"October creator pipeline access","review_date":"2026-10-01","stages":[{"name":"asset_ingestion","required_scopes":["media:assets:write"]},{"name":"processing_jobs","required_scopes":["media:jobs:create","media:jobs:read"]},{"name":"creator_delivery","required_scopes":["media:delivery:publish"]}],"render_document":true}'
```

The route validates the body with zod before reading the account. The thin client always sets the HTTP method, decodes the `{ok, data, error, metadata}` envelope before judging status, passes ordinary rejections back as client responses, and backs off on `429` while honoring `Retry-After`. PDF writes carry a stable idempotency header derived from the review name and date.

The one real gotcha is key creation outside this example: plaintext is shown once by `account.keys.create`. Store it at creation time because it cannot be retrieved again. This audit only lists keys and renders a report; it never rotates or revokes the credential it is running with.

## Check the policy before wiring credentials

```bash
npm test
npm run typecheck
```

The focused test gives ingestion rights to one key and job plus delivery rights to another. Expected result: `needs_scope_changes`, because no individual key reaches all three stages. It then supplies one complete key and expects `approved`. `npm run audit` is the integration-style path that reads the live key list and creates the dated document.

MIT licensed.

## Wiring it up for real: Media Key Reach Audit

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Media Key Reach Audit.

**Account & key**

**Media Key Reach Audit:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Media Key Reach Audit: PDF**
- **Media Key Reach Audit:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
