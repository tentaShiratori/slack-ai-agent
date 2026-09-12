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
const { readRawBody, slackVercelHandler } = await import("./vercel-slack.ts");

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

beforeEach(() => {
  vi.clearAllMocks();
});

test("string body を raw として読む", async () => {
  expect(await readRawBody({ body: '{"ok":true}' } as VercelRequest)).toBe('{"ok":true}');
});

test("Buffer body を raw として読む", async () => {
  expect(await readRawBody({ body: Buffer.from("abc") } as VercelRequest)).toBe("abc");
});

test("stream の chunk を結合する", async () => {
  const req = Readable.from(["hel", Buffer.from("lo")]) as unknown as VercelRequest;
  expect(await readRawBody(req)).toBe("hello");
});

test("空 stream は空文字", async () => {
  const req = Readable.from([]) as unknown as VercelRequest;
  expect(await readRawBody(req)).toBe("");
});

test("url_verification を JSON で返す", async () => {
  const res = mockRes();
  await slackVercelHandler(
    {
      method: "POST",
      url: "/api/slack/events",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "url_verification", challenge: "abc" }),
    } as VercelRequest,
    res,
  );
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ challenge: "abc" });
  expect(sentry.captureException).not.toHaveBeenCalled();
});

test("読み取り失敗は Sentry に送り 500", async () => {
  const res = mockRes();
  await slackVercelHandler(
    {
      method: "POST",
      url: "/api/slack/events",
      headers: {},
      async *[Symbol.asyncIterator]() {
        yield "";
        throw new Error("read fail");
      },
    } as VercelRequest,
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
    {
      method: "POST",
      url: "/api/slack/events",
      headers: {},
      async *[Symbol.asyncIterator]() {
        yield "";
        throw new Error("after write");
      },
    } as VercelRequest,
    res,
  );
  expect(sentry.captureException).toHaveBeenCalled();
  expect(res.status).not.toHaveBeenCalled();
});
