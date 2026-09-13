import { verifySlackSignature } from "../lib/slack/verify-signature.ts";
import { receiveSlack, type OpenBugModalInput } from "../usecase/receive-slack.ts";

export type WebhookRequest = {
  method: string;
  url: string;
  rawBody: string;
  contentType: string | undefined;
  slackTimestamp: string | undefined;
  slackSignature: string | undefined;
};

export type WebhookResponse = {
  status: number;
  body: unknown;
};

export type HttpDeps = {
  signingSecret: string;
  skipVerify: boolean;
  enqueue: (rawBody: string) => Promise<void>;
  openBugModal?: (input: OpenBugModalInput) => Promise<void>;
  nowMs?: () => number;
};

const slackPaths = new Set(["/api/slack/events", "/api/slack/commands", "/api/slack/interactive"]);

function pathOf(url: string): string {
  return url.split("?")[0] ?? "/";
}

export async function handleRequest(req: WebhookRequest, deps: HttpDeps): Promise<WebhookResponse> {
  const path = pathOf(req.url);
  if (req.method === "GET" && (path === "/health" || path === "/")) {
    return { status: 200, body: { ok: true, role: "webhook" } };
  }
  if (req.method === "POST" && slackPaths.has(path)) {
    if (
      !deps.skipVerify &&
      !verifySlackSignature({
        signingSecret: deps.signingSecret,
        rawBody: req.rawBody,
        timestamp: req.slackTimestamp,
        signature: req.slackSignature,
        nowMs: deps.nowMs?.(),
      })
    ) {
      return { status: 401, body: { error: "unauthorized" } };
    }
    return receiveSlack(req.rawBody, deps.enqueue, req.contentType, {
      openBugModal: deps.openBugModal,
    });
  }
  return { status: 404, body: { error: "not_found" } };
}
