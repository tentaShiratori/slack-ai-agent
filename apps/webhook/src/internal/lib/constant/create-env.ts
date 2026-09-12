import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

type RuntimeEnv = Record<string, string | undefined>;

const optionalSecret = z.string().min(1).optional();
const requiredSecret = z.string().min(1);

export function shouldSkipEnvValidation(runtimeEnv: RuntimeEnv): boolean {
  return runtimeEnv.NODE_ENV === "test" || runtimeEnv.SKIP_ENV_VALIDATION === "1";
}

export function createWebhookEnv(runtimeEnv: RuntimeEnv, skipValidation = false) {
  const skipSlackVerify = runtimeEnv.SKIP_SLACK_VERIFY === "1";
  return createEnv({
    server: {
      PORT: z.coerce.number().int().positive().default(3000),
      WORKER_URL: z.string().url(),
      WORKER_SECRET: z.string().min(1),
      SKIP_SLACK_VERIFY: z.string().optional(),
      SLACK_BOT_TOKEN: skipSlackVerify ? optionalSecret : requiredSecret,
      SLACK_SIGNING_SECRET: skipSlackVerify ? optionalSecret : requiredSecret,
      SENTRY_DSN: z.string().url().optional(),
      SENTRY_ENVIRONMENT: z.string().min(1).optional(),
      VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
      NODE_ENV: z.enum(["development", "test", "production"]).optional(),
      SERVICE_NAME: z.string().min(1).optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
    skipValidation,
  });
}
