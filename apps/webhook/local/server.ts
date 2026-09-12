import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { errorFields, log } from "../lib/logger.ts";
import { captureException, initSentry } from "../lib/sentry.ts";

process.env.SERVICE_NAME ??= "webhook";
initSentry();

const port = Number(process.env.PORT ?? 3000);
const workerUrl = process.env.WORKER_URL ?? "http://127.0.0.1:8080";
const workerSecret = process.env.WORKER_SECRET ?? "";
const skipSlackVerify = process.env.SKIP_SLACK_VERIFY === "1";
const signingSecret = process.env.SLACK_SIGNING_SECRET ?? "";

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

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
  } catch {
    json(res, 400, { error: "invalid_json" });
    return;
  }

  if (body.type === "url_verification") {
    json(res, 200, { challenge: body.challenge });
    return;
  }

  json(res, 200, { ok: true });

  fetch(`${workerUrl}/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": workerSecret,
    },
    body: rawBody,
  }).catch((error: unknown) => {
    captureException(error);
    log("ERROR", "failed to dispatch worker", errorFields(error));
  });
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
