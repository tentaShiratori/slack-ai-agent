import type { VercelRequest, VercelResponse } from "@vercel/node";
import { env } from "../lib/constant/env.ts";
import { errorFields, log } from "../lib/metrics/logger.ts";
import { captureException, flushSentry, initSentry } from "../lib/metrics/sentry.ts";
import { createOpenBugModal } from "../infra/slack/open-bug-modal.ts";
import { enqueueJob } from "../usecase/enqueue-job.ts";
import { handleRequest } from "./http.ts";

process.env.SERVICE_NAME ??= env.SERVICE_NAME ?? "webhook";
initSentry({
  dsn: env.SENTRY_DSN,
  environment: env.SENTRY_ENVIRONMENT ?? env.VERCEL_ENV ?? env.NODE_ENV,
});

function header(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === "string" ? value : undefined;
}

async function readRawBody(req: VercelRequest): Promise<string> {
  if (typeof req.body === "string") {
    return req.body;
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body.toString("utf8");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function slackVercelHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const rawBody = await readRawBody(req);
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
        skipVerify: env.SKIP_SLACK_VERIFY === "1" || env.VERCEL_ENV === "development",
        enqueue: enqueueJob,
        openBugModal: createOpenBugModal(env.SLACK_BOT_TOKEN ?? ""),
      },
    );
    res.status(result.status).json(result.body);
  } catch (error) {
    captureException(error);
    log("ERROR", "slack api handler failed", errorFields(error));
    await flushSentry();
    if (!res.headersSent) {
      res.status(500).json({ error: "internal" });
    }
  }
}
