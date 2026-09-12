import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { errorFields, log } from "./logger.ts";
import { captureException, flushSentry, initSentry } from "./sentry.ts";

process.env.SERVICE_NAME ??= "worker";

const port = Number(process.env.PORT ?? 8080);

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? "/";
  if (req.method === "GET" && (url === "/health" || url === "/")) {
    json(res, 200, { ok: true, role: "worker" });
    return;
  }
  json(res, 404, { error: "not_found" });
}

async function main() {
  initSentry();
  log("INFO", "starting worker");

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      await handle(req, res);
    } catch (error) {
      captureException(error);
      log("ERROR", "unhandled request error", errorFields(error));
      if (!res.headersSent) {
        json(res, 500, { error: "internal" });
      }
    }
  });

  server.listen(port, "0.0.0.0", () => {
    log("INFO", "worker listening", { port });
  });
}

main().catch(async (error: unknown) => {
  captureException(error);
  log("CRITICAL", "worker failed to start", errorFields(error));
  await flushSentry();
  process.exit(1);
});
