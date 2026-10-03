import { infraiFromEnvironment } from "./infrai_client.js";
import { auditRequestSchema, runMediaAccessAudit } from "./media_access_audit.js";

const input = auditRequestSchema.parse({
  review_name: "October creator pipeline access",
  review_date: new Date().toISOString().slice(0, 10),
  stages: [
    { name: "asset_ingestion", required_scopes: ["media:assets:write"] },
    { name: "processing_jobs", required_scopes: ["media:jobs:create", "media:jobs:read"] },
    { name: "creator_delivery", required_scopes: ["media:delivery:publish"] }
  ],
  render_document: true
});

console.log(JSON.stringify(await runMediaAccessAudit(infraiFromEnvironment(), input), null, 2));
