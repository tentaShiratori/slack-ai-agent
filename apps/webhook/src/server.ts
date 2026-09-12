import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { env } from "./internal/lib/constant/env.ts";
import { handleRequest } from "./internal/controller/http.ts";
import { enqueueJob } from "./internal/usecase/enqueue-job.ts";
import { errorFields, log } from "./internal/lib/metrics/logger.ts";
import { captureException, flushSentry, initSentry } from "./internal/lib/metrics/sentry.ts";

process.env.SERVICE_NAME ??= env.SERVICE_NAME ?? "webhook";
initSentry({
  dsn: env.SENTRY_DSN,
  environment: env.SENTRY_ENVIRONMENT ?? env.VERCEL_ENV ?? env.NODE_ENV,
});

const port = env.PORT;

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === "string" ? value : undefined;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  try {
    const rawBody = req.method === "POST" ? await readBody(req) : "";
    const result = await handleRequest(
      {
        method: req.method ?? "GET",
        url: req.url ?? "/",
        rawBody,
        contentType: header(req, "content-type"),
        slackTimestamp: header(req, "x-slack-request-timestamp"),
        slackSignature: header(req, "x-slack-signature"),
      },
      {
        signingSecret: env.SLACK_SIGNING_SECRET ?? "",
        skipVerify: env.SKIP_SLACK_VERIFY === "1",
        enqueue: enqueueJob,
      },
    );
    json(res, result.status, result.body);
  } catch (error) {
    captureException(error);
    log("ERROR", "unhandled request error", errorFields(error));
    if (!res.headersSent) {
      json(res, 500, { error: "internal" });
    }
  }
});

const shutdown = () => {
  server.close(async () => {
    await flushSentry();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(port, "0.0.0.0", () => {
  log("INFO", "webhook listening", { port });
});
