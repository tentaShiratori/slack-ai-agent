import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@sentry/node", () => ({
  init: vi.fn<() => void>(),
  captureException: vi.fn<(error: unknown) => void>(),
  flush: vi.fn<(timeoutMs?: number) => Promise<boolean>>(async () => true),
}));

const Sentry = await import("@sentry/node");
const { captureException, flushSentry, initSentry } = await import("./sentry.ts");

const originalDsn = process.env.SENTRY_DSN;
const originalEnv = process.env.SENTRY_ENVIRONMENT;
const originalVercel = process.env.VERCEL_ENV;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SENTRY_DSN;
  delete process.env.SENTRY_ENVIRONMENT;
  delete process.env.VERCEL_ENV;
  initSentry({ dsn: "" });
});

afterEach(() => {
  if (originalDsn === undefined) {
    delete process.env.SENTRY_DSN;
  } else {
    process.env.SENTRY_DSN = originalDsn;
  }
  if (originalEnv === undefined) {
    delete process.env.SENTRY_ENVIRONMENT;
  } else {
    process.env.SENTRY_ENVIRONMENT = originalEnv;
  }
  if (originalVercel === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = originalVercel;
  }
});

test("DSN なしでは init しない", () => {
  expect(initSentry({ dsn: "" })).toBe(false);
  expect(Sentry.init).not.toHaveBeenCalled();
});

test("空白だけの DSN は無効", () => {
  expect(initSentry({ dsn: "  " })).toBe(false);
  expect(Sentry.init).not.toHaveBeenCalled();
});

test("DSN ありで init する", () => {
  expect(initSentry({ dsn: "https://key@o.ingest.sentry.io/1", environment: "test" })).toBe(true);
  expect(Sentry.init).toHaveBeenCalledWith({
    dsn: "https://key@o.ingest.sentry.io/1",
    environment: "test",
  });
});

test("VERCEL_ENV を environment に使う", () => {
  process.env.SENTRY_DSN = "https://env@o.ingest.sentry.io/2";
  process.env.VERCEL_ENV = "preview";
  expect(initSentry()).toBe(true);
  expect(Sentry.init).toHaveBeenCalledWith({
    dsn: "https://env@o.ingest.sentry.io/2",
    environment: "preview",
  });
});

test("init 後の例外を capture する", () => {
  initSentry({ dsn: "https://key@o.ingest.sentry.io/1" });
  const error = new Error("boom");
  captureException(error);
  expect(Sentry.captureException).toHaveBeenCalledWith(error);
});

test("init 前の capture は何もしない", () => {
  captureException(new Error("nope"));
  expect(Sentry.captureException).not.toHaveBeenCalled();
});

test("DSN を外すと capture しない", () => {
  initSentry({ dsn: "https://key@o.ingest.sentry.io/1" });
  initSentry({ dsn: "" });
  captureException(new Error("later"));
  expect(Sentry.captureException).not.toHaveBeenCalled();
});

test("init 後は flush する", async () => {
  initSentry({ dsn: "https://key@o.ingest.sentry.io/1" });
  await flushSentry(1500);
  expect(Sentry.flush).toHaveBeenCalledWith(1500);
});

test("無効時の flush は何もしない", async () => {
  await flushSentry();
  expect(Sentry.flush).not.toHaveBeenCalled();
});
