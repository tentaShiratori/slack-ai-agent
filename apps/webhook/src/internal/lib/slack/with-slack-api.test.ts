import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, expect, test, vi } from "vitest";

process.env.VERCEL_ENV = "development";

vi.mock("../metrics/sentry.ts", () => ({
  initSentry: vi.fn<() => boolean>(),
  captureException: vi.fn<(error: unknown) => void>(),
  flushSentry: vi.fn<(timeoutMs?: number) => Promise<void>>(async () => undefined),
}));

vi.mock("../constant/constant.ts", () => ({
  isDevelopment: false,
}));

vi.mock("./verifyRequest.ts", () => ({
  verifySlackRequest: vi.fn<(req: VercelRequest) => void>(),
}));

const sentry = await import("../metrics/sentry.ts");
const verify = await import("./verifyRequest.ts");
const { withSlackApi } = await import("./with-slack-api.ts");

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
  vi.mocked(verify.verifySlackRequest).mockImplementation(() => undefined);
});

test("ハンドラが成功したら 500 にしない", async () => {
  const res = mockRes();
  const handler = withSlackApi(async (_req, response) => {
    response.status(200).json("ok");
  });
  await handler({} as VercelRequest, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(sentry.captureException).not.toHaveBeenCalled();
});

test("ハンドラが投げたら Sentry に送り 500 を返す", async () => {
  const res = mockRes();
  const error = new Error("boom");
  const handler = withSlackApi(async () => {
    throw error;
  });
  await handler({} as VercelRequest, res);
  expect(sentry.captureException).toHaveBeenCalledWith(error);
  expect(sentry.flushSentry).toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ error: "internal" });
});

test("署名検証失敗は 401", async () => {
  vi.mocked(verify.verifySlackRequest).mockImplementation(() => {
    throw new Error("signature mismatch");
  });
  const res = mockRes();
  const handler = withSlackApi(async (_req, response) => {
    response.status(200).json("ok");
  });
  await handler({} as VercelRequest, res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith({ error: "unauthorized" });
  expect(sentry.captureException).not.toHaveBeenCalled();
});

test("ヘッダ送信済みなら 500 を書かない", async () => {
  const res = mockRes(true);
  const handler = withSlackApi(async () => {
    throw new Error("after write");
  });
  await handler({} as VercelRequest, res);
  expect(sentry.captureException).toHaveBeenCalled();
  expect(res.status).not.toHaveBeenCalled();
});
