import { createHash } from "node:crypto";
import { z } from "zod";
import type { InfraiClient } from "./infrai_client.js";

const stageSchema = z.object({
  name: z.enum(["asset_ingestion", "processing_jobs", "creator_delivery"]),
  required_scopes: z.array(z.string().min(1)).min(1)
});

export const auditRequestSchema = z.object({
  review_name: z.string().min(1),
  review_date: z.string().date(),
  stages: z.array(stageSchema).length(3),
  render_document: z.boolean().default(true)
}).superRefine((value, context) => {
  if (new Set(value.stages.map((stage) => stage.name)).size !== 3) {
    context.addIssue({ code: "custom", message: "Each media stage must appear once", path: ["stages"] });
  }
});

export type AuditRequest = z.infer<typeof auditRequestSchema>;

const accountKeysSchema = z.union([
  z.array(z.object({ id: z.string(), name: z.string().optional(), scopes: z.array(z.string()) }).passthrough()),
  z.object({
    keys: z.array(z.object({ id: z.string(), name: z.string().optional(), scopes: z.array(z.string()) }).passthrough())
  })
]).transform((value) => Array.isArray(value) ? value : value.keys);

export type AccountKey = z.infer<typeof accountKeysSchema>[number];

export function assessMediaReach(keys: AccountKey[], stages: AuditRequest["stages"]) {
  const keysWithReach = keys.map((key) => ({
    key_id: key.id,
    key_name: key.name ?? "unnamed",
    stages: stages.map((stage) => {
      const missing_scopes = stage.required_scopes.filter((scope) => !key.scopes.includes(scope));
      return {
        name: stage.name,
        reachable: missing_scopes.length === 0,
        missing_scopes
      };
    })
  }));

  const completeKey = keysWithReach.find((key) => key.stages.every((stage) => stage.reachable));
  return {
    decision: completeKey ? "approved" as const : "needs_scope_changes" as const,
    delivery_key_id: completeKey?.key_id ?? null,
    keys: keysWithReach
  };
}

function toMarkdown(input: AuditRequest, result: ReturnType<typeof assessMediaReach>): string {
  const rows = result.keys.flatMap((key) => key.stages.map((stage) =>
    `| ${key.key_name} | ${stage.name} | ${stage.reachable ? "yes" : "no"} | ${stage.missing_scopes.join(", ") || "none"} |`
  ));
  return [
    `# ${input.review_name}`,
    "",
    `Review date: ${input.review_date}`,
    `Decision: ${result.decision}`,
    `Delivery key: ${result.delivery_key_id ?? "none"}`,
    "",
    "| Key | Media stage | Reachable | Missing scopes |",
    "| --- | --- | --- | --- |",
    ...rows
  ].join("\n");
}

export async function runMediaAccessAudit(client: InfraiClient, input: AuditRequest) {
  const keys = accountKeysSchema.parse(await client.listAccountKeys());
  const result = assessMediaReach(keys, input.stages);
  const document = input.render_document
    ? await client.generateAuditDocument(
        { markdown: toMarkdown(input, result), page_size: "A4", orientation: "landscape", store: true },
        createHash("sha256").update(`${input.review_name}:${input.review_date}`).digest("hex")
      )
    : null;
  return { review_name: input.review_name, review_date: input.review_date, ...result, document };
}
