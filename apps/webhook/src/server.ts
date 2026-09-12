import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { env } from "./internal/lib/constant/env.ts";
import { enqueueJob } from "./internal/usecase/enqueue-job.ts";
import { handleSlackEvent } from "./internal/lib/slack/handle-slack-event.ts";
import { errorFields, log } from "./internal/lib/metrics/logger.ts";
import { captureException, initSentry } from "./internal/lib/metrics/sentry.ts";

process.env.SERVICE_NAME ??= env.SERVICE_NAME ?? "webhook";
initSentry({
  dsn: env.SENTRY_DSN,
  environment: env.SENTRY_ENVIRONMENT ?? env.VERCEL_ENV ?? env.NODE_ENV,
});

const port = env.PORT;
const skipSlackVerify = env.SKIP_SLACK_VERIFY === "1";
const signingSecret = env.SLACK_SIGNING_SECRET ?? "";

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

function verifySlackSignature(req: IncomingMessage, rawBody: Buffer): boolean {
  const timestamp = req.headers["x-slack-request-timestamp"];
  const signature = req.headers["x-slack-signature"];
  if (typeof timestamp !== "string" || typeof signature !== "string") {
    return false;
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 60 * 5) {
    return false;
  }
  const [version, hash] = signature.split("=");
  if (version !== "v0" || !hash) {
    return false;
  }
  const hmac = createHmac("sha256", signingSecret);
  hmac.update(`${version}:${timestamp}:${rawBody.toString("utf8")}`);
  const digest = hmac.digest("hex");
  const a = Buffer.from(hash, "utf8");
  const b = Buffer.from(digest, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handleEvents(req: IncomingMessage, res: ServerResponse) {
  const rawBody = await readBody(req);
  if (!skipSlackVerify && !verifySlackSignature(req, rawBody)) {
    json(res, 403, { error: "forbidden" });
    return;
  }

  const result = await handleSlackEvent(rawBody.toString("utf8"), enqueueJob);
  json(res, result.status, result.body);
}

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";
  if (req.method === "GET" && (url === "/health" || url === "/")) {
    json(res, 200, { ok: true, role: "webhook" });
    return;
  }
  if (req.method === "POST" && url.startsWith("/api/slack/events")) {
    try {
      await handleEvents(req, res);
    } catch (error) {
      captureException(error);
      log("ERROR", "unhandled request error", errorFields(error));
      if (!res.headersSent) {
        json(res, 500, { error: "internal" });
      }
    }
    return;
  }
  json(res, 404, { error: "not_found" });
});

server.listen(port, "0.0.0.0", () => {
  log("INFO", "webhook listening", { port });
});
