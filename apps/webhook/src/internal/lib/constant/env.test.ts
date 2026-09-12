import { expect, test } from "vitest";
import { createWebhookEnv, shouldSkipEnvValidation } from "./create-env.ts";

const valid = {
  WORKER_URL: "http://127.0.0.1:8080",
  WORKER_SECRET: "dev-secret",
  SLACK_BOT_TOKEN: "xoxb-test-token",
  SLACK_SIGNING_SECRET: "signing-secret",
};

test("必須変数があれば通る", () => {
  const env = createWebhookEnv(valid);
  expect(env.WORKER_URL).toBe(valid.WORKER_URL);
  expect(env.WORKER_SECRET).toBe(valid.WORKER_SECRET);
  expect(env.SLACK_BOT_TOKEN).toBe(valid.SLACK_BOT_TOKEN);
  expect(env.SLACK_SIGNING_SECRET).toBe(valid.SLACK_SIGNING_SECRET);
  expect(env.PORT).toBe(3000);
});

test("PORT を数値にする", () => {
  const env = createWebhookEnv({ ...valid, PORT: "4000" });
  expect(env.PORT).toBe(4000);
});

test("PORT が 0 以下だと失敗する", () => {
  expect(() => createWebhookEnv({ ...valid, PORT: "0" })).toThrow("Invalid environment variables");
  expect(() => createWebhookEnv({ ...valid, PORT: "-1" })).toThrow("Invalid environment variables");
});

test("SKIP_SLACK_VERIFY=1 以外では Slack token が要る", () => {
  expect(() =>
    createWebhookEnv({
      WORKER_URL: valid.WORKER_URL,
      WORKER_SECRET: valid.WORKER_SECRET,
      SKIP_SLACK_VERIFY: "0",
    }),
  ).toThrow("Invalid environment variables");
});

test("SKIP_SLACK_VERIFY=1 なら Slack token なしで通る", () => {
  const env = createWebhookEnv({
    WORKER_URL: valid.WORKER_URL,
    WORKER_SECRET: valid.WORKER_SECRET,
    SKIP_SLACK_VERIFY: "1",
  });
  expect(env.SKIP_SLACK_VERIFY).toBe("1");
  expect(env.SLACK_BOT_TOKEN).toBeUndefined();
  expect(env.SLACK_SIGNING_SECRET).toBeUndefined();
});

test("Slack token が無いと失敗する", () => {
  expect(() =>
    createWebhookEnv({
      WORKER_URL: valid.WORKER_URL,
      WORKER_SECRET: valid.WORKER_SECRET,
    }),
  ).toThrow("Invalid environment variables");
});

test("WORKER_URL が無いと失敗する", () => {
  expect(() =>
    createWebhookEnv({
      WORKER_SECRET: valid.WORKER_SECRET,
      SLACK_BOT_TOKEN: valid.SLACK_BOT_TOKEN,
      SLACK_SIGNING_SECRET: valid.SLACK_SIGNING_SECRET,
    }),
  ).toThrow("Invalid environment variables");
});

test("WORKER_SECRET が無いと失敗する", () => {
  expect(() =>
    createWebhookEnv({
      WORKER_URL: valid.WORKER_URL,
      SLACK_BOT_TOKEN: valid.SLACK_BOT_TOKEN,
      SLACK_SIGNING_SECRET: valid.SLACK_SIGNING_SECRET,
    }),
  ).toThrow("Invalid environment variables");
});

test("空文字の必須変数は失敗する", () => {
  expect(() => createWebhookEnv({ ...valid, WORKER_SECRET: "" })).toThrow(
    "Invalid environment variables",
  );
  expect(() => createWebhookEnv({ ...valid, WORKER_URL: "" })).toThrow(
    "Invalid environment variables",
  );
  expect(() => createWebhookEnv({ ...valid, SLACK_BOT_TOKEN: "" })).toThrow(
    "Invalid environment variables",
  );
});

test("WORKER_URL が URL でないと失敗する", () => {
  expect(() => createWebhookEnv({ ...valid, WORKER_URL: "not-a-url" })).toThrow(
    "Invalid environment variables",
  );
});

test("SENTRY_DSN は省略できる", () => {
  expect(createWebhookEnv(valid).SENTRY_DSN).toBeUndefined();
});

test("SENTRY_DSN が URL でないと失敗する", () => {
  expect(() => createWebhookEnv({ ...valid, SENTRY_DSN: "not-a-url" })).toThrow(
    "Invalid environment variables",
  );
});

test("VERCEL_ENV=development を読む", () => {
  const env = createWebhookEnv({ ...valid, VERCEL_ENV: "development" });
  expect(env.VERCEL_ENV).toBe("development");
});

test("NODE_ENV=test なら検証をスキップする", () => {
  expect(shouldSkipEnvValidation({ NODE_ENV: "test" })).toBe(true);
  expect(shouldSkipEnvValidation({ SKIP_ENV_VALIDATION: "1" })).toBe(true);
  expect(shouldSkipEnvValidation({})).toBe(false);
});

test("skipValidation なら欠けていても通る", () => {
  expect(() => createWebhookEnv({}, true)).not.toThrow();
});
