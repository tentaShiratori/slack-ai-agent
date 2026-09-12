import { expect, test } from "vitest";
import { createWorkerEnv, shouldSkipEnvValidation } from "./create-env.ts";

const valid = {
  REDIS_URL: "redis://127.0.0.1:6379",
  WORKER_SECRET: "dev-secret",
};

test("必須変数があれば通る", () => {
  const env = createWorkerEnv(valid);
  expect(env.REDIS_URL).toBe(valid.REDIS_URL);
  expect(env.WORKER_SECRET).toBe(valid.WORKER_SECRET);
  expect(env.PORT).toBe(8080);
});

test("PORT を数値にする", () => {
  const env = createWorkerEnv({ ...valid, PORT: "9090" });
  expect(env.PORT).toBe(9090);
});

test("PORT が 0 以下だと失敗する", () => {
  expect(() => createWorkerEnv({ ...valid, PORT: "0" })).toThrow("Invalid environment variables");
  expect(() => createWorkerEnv({ ...valid, PORT: "-1" })).toThrow("Invalid environment variables");
});

test("REDIS_URL が無いと失敗する", () => {
  expect(() => createWorkerEnv({ WORKER_SECRET: "dev-secret" })).toThrow(
    "Invalid environment variables",
  );
});

test("WORKER_SECRET が無いと失敗する", () => {
  expect(() => createWorkerEnv({ REDIS_URL: valid.REDIS_URL })).toThrow(
    "Invalid environment variables",
  );
});

test("空文字の必須変数は失敗する", () => {
  expect(() => createWorkerEnv({ ...valid, WORKER_SECRET: "" })).toThrow(
    "Invalid environment variables",
  );
  expect(() => createWorkerEnv({ ...valid, REDIS_URL: "" })).toThrow(
    "Invalid environment variables",
  );
});

test("REDIS_URL が URL でないと失敗する", () => {
  expect(() => createWorkerEnv({ ...valid, REDIS_URL: "not-a-url" })).toThrow(
    "Invalid environment variables",
  );
});

test("SENTRY_DSN は省略できる", () => {
  const env = createWorkerEnv(valid);
  expect(env.SENTRY_DSN).toBeUndefined();
});

test("SENTRY_DSN が URL なら通る", () => {
  const env = createWorkerEnv({
    ...valid,
    SENTRY_DSN: "https://key@o.ingest.sentry.io/1",
  });
  expect(env.SENTRY_DSN).toBe("https://key@o.ingest.sentry.io/1");
});

test("SENTRY_DSN が URL でないと失敗する", () => {
  expect(() => createWorkerEnv({ ...valid, SENTRY_DSN: "not-a-url" })).toThrow(
    "Invalid environment variables",
  );
});

test("NODE_ENV=test なら検証をスキップする", () => {
  expect(shouldSkipEnvValidation({ NODE_ENV: "test" })).toBe(true);
  expect(shouldSkipEnvValidation({ SKIP_ENV_VALIDATION: "1" })).toBe(true);
  expect(shouldSkipEnvValidation({})).toBe(false);
});

test("skipValidation なら欠けていても通る", () => {
  expect(() => createWorkerEnv({}, true)).not.toThrow();
});
