import { createHmac } from "node:crypto";
import { expect, test, vi } from "vitest";
import type { OpenBugModal } from "../infra/slack/open-bug-modal.ts";
import { handleRequest, type HttpDeps, type WebhookRequest } from "./http.ts";

const secret = "signing-secret";
const nowMs = 1_700_000_000_000;
const timestamp = String(Math.floor(nowMs / 1000));

function sign(rawBody: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(`v0:${timestamp}:${rawBody}`);
  return `v0=${hmac.digest("hex")}`;
}

function deps(extra?: Partial<HttpDeps>): HttpDeps {
  return {
    signingSecret: secret,
    skipVerify: false,
    enqueue: vi.fn<(rawBody: string) => Promise<void>>(async () => undefined),
    nowMs: () => nowMs,
    ...extra,
  };
}

function slackReq(path: string, rawBody: string, extra?: Partial<WebhookRequest>): WebhookRequest {
  return {
    method: "POST",
    url: path,
    rawBody,
    contentType: "application/json",
    slackTimestamp: timestamp,
    slackSignature: sign(rawBody),
    ...extra,
  };
}

test("GET /health は ok", async () => {
  const res = await handleRequest(
    {
      method: "GET",
      url: "/health",
      rawBody: "",
      contentType: undefined,
      slackTimestamp: undefined,
      slackSignature: undefined,
    },
    deps(),
  );
  expect(res).toEqual({ status: 200, body: { ok: true, role: "webhook" } });
});

test("GET / は health と同じ", async () => {
  const res = await handleRequest(
    {
      method: "GET",
      url: "/",
      rawBody: "",
      contentType: undefined,
      slackTimestamp: undefined,
      slackSignature: undefined,
    },
    deps(),
  );
  expect(res.status).toBe(200);
});

test("未知のパスは 404", async () => {
  const res = await handleRequest(slackReq("/api/slack/unknown", "{}"), deps());
  expect(res).toEqual({ status: 404, body: { error: "not_found" } });
});

test("署名が無い POST は 401", async () => {
  const d = deps();
  const res = await handleRequest(
    slackReq("/api/slack/events", "{}", { slackSignature: undefined }),
    d,
  );
  expect(res).toEqual({ status: 401, body: { error: "unauthorized" } });
  expect(d.enqueue).not.toHaveBeenCalled();
});

test("署名が違う POST は 401", async () => {
  const res = await handleRequest(
    slackReq("/api/slack/events", "{}", { slackSignature: "v0=deadbeef" }),
    deps(),
  );
  expect(res).toEqual({ status: 401, body: { error: "unauthorized" } });
});

test("skipVerify なら署名なしでも受ける", async () => {
  const d = deps({ skipVerify: true });
  const res = await handleRequest(
    slackReq("/api/slack/events", JSON.stringify({ type: "url_verification", challenge: "c" }), {
      slackSignature: undefined,
    }),
    d,
  );
  expect(res).toEqual({ status: 200, body: { challenge: "c" } });
});

test("events / commands / interactive を受ける", async () => {
  const mention = JSON.stringify({
    type: "event_callback",
    event_id: "evt-1",
    event: { type: "app_mention", channel: "C1", ts: "1.0" },
  });
  const slash = new URLSearchParams({
    command: "/grill",
    trigger_id: "trig-1",
    channel_id: "C1",
  }).toString();
  const interactive = new URLSearchParams({
    payload: JSON.stringify({ type: "view_submission", trigger_id: "trig-2" }),
  }).toString();

  const events = deps();
  await expect(handleRequest(slackReq("/api/slack/events", mention), events)).resolves.toEqual({
    status: 200,
    body: { ok: true },
  });
  expect(events.enqueue).toHaveBeenCalledTimes(1);

  const commands = deps();
  await expect(
    handleRequest(
      slackReq("/api/slack/commands", slash, {
        contentType: "application/x-www-form-urlencoded",
        slackSignature: sign(slash),
      }),
      commands,
    ),
  ).resolves.toMatchObject({ status: 200 });
  expect(commands.enqueue).toHaveBeenCalledTimes(1);

  const views = deps();
  await expect(
    handleRequest(
      slackReq("/api/slack/interactive", interactive, {
        contentType: "application/x-www-form-urlencoded",
        slackSignature: sign(interactive),
      }),
      views,
    ),
  ).resolves.toMatchObject({ status: 200 });
  expect(views.enqueue).toHaveBeenCalledTimes(1);
});

test("query 付きパスでも events を受ける", async () => {
  const body = JSON.stringify({ type: "url_verification", challenge: "q" });
  const res = await handleRequest(slackReq("/api/slack/events?ssl_check=1", body), deps());
  expect(res).toEqual({ status: 200, body: { challenge: "q" } });
});

test("/bug はモーダルを開いて enqueue しない", async () => {
  const slash = new URLSearchParams({
    command: "/bug",
    trigger_id: "trig-1",
    channel_id: "C1",
  }).toString();
  const openBugModal = vi.fn<OpenBugModal>(async () => undefined);
  const d = deps({ openBugModal });
  const res = await handleRequest(
    slackReq("/api/slack/commands", slash, {
      contentType: "application/x-www-form-urlencoded",
      slackSignature: sign(slash),
    }),
    d,
  );
  expect(res).toEqual({ status: 200, body: { ok: true } });
  expect(d.enqueue).not.toHaveBeenCalled();
  expect(openBugModal).toHaveBeenCalledWith({
    triggerId: "trig-1",
    channelId: "C1",
    threadTs: undefined,
  });
});
