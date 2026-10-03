import assert from "node:assert/strict";
import test from "node:test";
import { assessMediaReach } from "../src/media_access_audit.js";

const stages = [
  { name: "asset_ingestion" as const, required_scopes: ["media:assets:write"] },
  { name: "processing_jobs" as const, required_scopes: ["media:jobs:create", "media:jobs:read"] },
  { name: "creator_delivery" as const, required_scopes: ["media:delivery:publish"] }
];

test("requires one key to reach ingestion, jobs, and creator delivery", () => {
  const result = assessMediaReach([
    { id: "upload-key", name: "Uploader", scopes: ["media:assets:write"] },
    { id: "worker-key", name: "Worker", scopes: ["media:jobs:create", "media:jobs:read", "media:delivery:publish"] }
  ], stages);

  assert.equal(result.decision, "needs_scope_changes");
  assert.equal(result.delivery_key_id, null);
  assert.deepEqual(result.keys[0]?.stages[2]?.missing_scopes, ["media:delivery:publish"]);
  assert.deepEqual(result.keys[1]?.stages[0]?.missing_scopes, ["media:assets:write"]);
});

test("approves a key that reaches the full media path", () => {
  const result = assessMediaReach([
    {
      id: "creator-pipeline",
      scopes: ["media:assets:write", "media:jobs:create", "media:jobs:read", "media:delivery:publish"]
    }
  ], stages);

  assert.equal(result.decision, "approved");
  assert.equal(result.delivery_key_id, "creator-pipeline");
});
