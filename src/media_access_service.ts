import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, infraiFromEnvironment } from "./infrai_client.js";
import { auditRequestSchema, runMediaAccessAudit } from "./media_access_audit.js";

const client = infraiFromEnvironment();
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/media-access-reviews") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "route_not_found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = auditRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const audit = await runMediaAccessAudit(client, input);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(audit));
  } catch (error) {
    const status = error instanceof ZodError || error instanceof SyntaxError
      ? 400
      : error instanceof InfraiError && error.status >= 400 && error.status < 500
        ? error.status
        : 502;
    const payload = error instanceof ZodError
      ? { error: "invalid_request", issues: error.issues }
      : error instanceof InfraiError
        ? { error: error.code, details: error.details }
        : { error: "audit_failed" };
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  }
}).listen(port, () => console.log(`Media access review listening on http://localhost:${port}`));
