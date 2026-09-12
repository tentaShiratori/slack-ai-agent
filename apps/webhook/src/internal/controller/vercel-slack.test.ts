import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, expect, test, vi } from "vitest";
import { Readable } from "node:stream";

vi.mock("../lib/constant/env.ts", () => ({
  env: {
    SERVICE_NAME: "webhook",
    SLACK_SIGNING_SECRET: "signing-secret",
    SKIP_SLACK_VERIFY: "1",
    VERCEL_ENV: "production",
    SENTRY_DSN: undefined,
  },
}));

vi.mock("../lib/metrics/sentry.ts", () => ({
  initSentry: vi.fn<() => boolean>(),
  captureException: vi.fn<(error: unknown) => void>(),
  flushSentry: vi.fn<(timeoutMs?: number) => Promise<void>>(async () => undefined),
}));

vi.mock("../usecase/enqueue-job.ts", () => ({
  enqueueJob: vi.fn<(rawBody: string) => Promise<void>>(async () => undefined),
}));

const sentry = await import("../lib/metrics/sentry.ts");
const { slackVercelHandler } = await import("./vercel-slack.ts");

const challengeBody = JSON.stringify({ type: "url_verification", challenge: "abc" });

function mockRes(headersSent = false) {
  return {
    headersSent,
    status: vi.fn<(code: number) => VercelResponse>().mockReturnThis(),
    json: vi.fn<(body: unknown) => VercelResponse>(),
  } as unknown as VercelResponse & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function eventsReq(extra: Partial<VercelRequest> & object): VercelRequest {
  return {
    method: "POST",
    url: "/api/slack/events",
    headers: { "content-type": "application/json" },
    ...extra,
  } as VercelRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("string body を raw として読む", async () => {
  const res = mockRes();
  await slackVercelHandler(eventsReq({ body: challengeBody }), res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ challenge: "abc" });
});

test("Buffer body を raw として読む", async () => {
  const res = mockRes();
  await slackVercelHandler(eventsReq({ body: Buffer.from(challengeBody) }), res);
  expect(res.json).toHaveBeenCalledWith({ challenge: "abc" });
});

test("stream の chunk を結合する", async () => {
  const res = mockRes();
  const req = Readable.from([
    challengeBody.slice(0, 8),
    challengeBody.slice(8),
  ]) as unknown as VercelRequest;
  Object.assign(req, {
    method: "POST",
    url: "/api/slack/events",
    headers: { "content-type": "application/json" },
  });
  await slackVercelHandler(req, res);
  expect(res.json).toHaveBeenCalledWith({ challenge: "abc" });
});

test("空 stream は 400", async () => {
  const res = mockRes();
  const req = Readable.from([]) as unknown as VercelRequest;
  Object.assign(req, {
    method: "POST",
    url: "/api/slack/events",
    headers: { "content-type": "application/json" },
  });
  await slackVercelHandler(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: "invalid_json" });
});

test("url_verification を JSON で返す", async () => {
  const res = mockRes();
  await slackVercelHandler(eventsReq({ body: challengeBody }), res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ challenge: "abc" });
  expect(sentry.captureException).not.toHaveBeenCalled();
});

test("読み取り失敗は Sentry に送り 500", async () => {
  const res = mockRes();
  await slackVercelHandler(
    eventsReq({
      async *[Symbol.asyncIterator]() {
        yield "";
        throw new Error("read fail");
      },
    }),
    res,
  );
  expect(sentry.captureException).toHaveBeenCalled();
  expect(sentry.flushSentry).toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ error: "internal" });
});

test("ヘッダ送信済みなら 500 を書かない", async () => {
  const res = mockRes(true);
  await slackVercelHandler(
    eventsReq({
      async *[Symbol.asyncIterator]() {
        yield "";
        throw new Error("after write");
      },
    }),
    res,
  );
  expect(sentry.captureException).toHaveBeenCalled();
  expect(res.status).not.toHaveBeenCalled();
});
