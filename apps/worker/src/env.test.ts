import { expect, test } from "vitest";
import { createWorkerEnv, shouldSkipEnvValidation } from "./create-env.ts";

const valid = {
  REDIS_URL: "redis://127.0.0.1:6379",
  WORKER_SECRET: "dev-secret",
  GITHUB_PAT: "github_pat_dev",
  GITHUB_DEFAULT_REPO: "acme/app",
  GITHUB_PROJECT_ID: "PVT_1",
  GITHUB_DISCUSSION_CATEGORY_ID: "DIC_1",
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

test("GitHub の必須変数を読む", () => {
  const env = createWorkerEnv(valid);
  expect(env.GITHUB_PAT).toBe(valid.GITHUB_PAT);
  expect(env.GITHUB_DEFAULT_REPO).toBe("acme/app");
  expect(env.GITHUB_PROJECT_ID).toBe("PVT_1");
  expect(env.GITHUB_DISCUSSION_CATEGORY_ID).toBe("DIC_1");
  expect(env.GITHUB_DISCUSSION_REPO).toBeUndefined();
});

test("GITHUB_DISCUSSION_REPO は省略できる", () => {
  const env = createWorkerEnv({ ...valid, GITHUB_DISCUSSION_REPO: "acme/notes" });
  expect(env.GITHUB_DISCUSSION_REPO).toBe("acme/notes");
});

test("GITHUB_PAT が無いと失敗する", () => {
  expect(() =>
    createWorkerEnv({
      REDIS_URL: valid.REDIS_URL,
      WORKER_SECRET: valid.WORKER_SECRET,
      GITHUB_DEFAULT_REPO: valid.GITHUB_DEFAULT_REPO,
      GITHUB_PROJECT_ID: valid.GITHUB_PROJECT_ID,
      GITHUB_DISCUSSION_CATEGORY_ID: valid.GITHUB_DISCUSSION_CATEGORY_ID,
    }),
  ).toThrow("Invalid environment variables");
});

test("GITHUB_DEFAULT_REPO が owner/repo でないと失敗する", () => {
  expect(() => createWorkerEnv({ ...valid, GITHUB_DEFAULT_REPO: "acme" })).toThrow(
    "Invalid environment variables",
  );
  expect(() => createWorkerEnv({ ...valid, GITHUB_DEFAULT_REPO: "acme/app/extra" })).toThrow(
    "Invalid environment variables",
  );
});

test("GITHUB_DISCUSSION_REPO が owner/repo でないと失敗する", () => {
  expect(() => createWorkerEnv({ ...valid, GITHUB_DISCUSSION_REPO: "notes" })).toThrow(
    "Invalid environment variables",
  );
});

test("空文字の GitHub 変数は失敗する", () => {
  expect(() => createWorkerEnv({ ...valid, GITHUB_PROJECT_ID: "" })).toThrow(
    "Invalid environment variables",
  );
  expect(() => createWorkerEnv({ ...valid, GITHUB_DISCUSSION_CATEGORY_ID: "" })).toThrow(
    "Invalid environment variables",
  );
});
