import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

type RuntimeEnv = Record<string, string | undefined>;

const ownerRepo = z.string().regex(/^[^/\s]+\/[^/\s]+$/);

export function shouldSkipEnvValidation(runtimeEnv: RuntimeEnv): boolean {
  return runtimeEnv.NODE_ENV === "test" || runtimeEnv.SKIP_ENV_VALIDATION === "1";
}

export function createWorkerEnv(runtimeEnv: RuntimeEnv, skipValidation = false) {
  return createEnv({
    server: {
      PORT: z.coerce.number().int().positive().default(8080),
      REDIS_URL: z.string().url(),
      WORKER_SECRET: z.string().min(1),
      GITHUB_PAT: z.string().min(1),
      GITHUB_DEFAULT_REPO: ownerRepo,
      GITHUB_PROJECT_ID: z.string().min(1),
      GITHUB_DISCUSSION_REPO: ownerRepo.optional(),
      GITHUB_DISCUSSION_CATEGORY_ID: z.string().min(1),
      SLACK_BOT_TOKEN: z.string().min(1),
      CURSOR_API_KEY: z.string().min(1),
      SENTRY_DSN: z.string().url().optional(),
      SENTRY_ENVIRONMENT: z.string().min(1).optional(),
      NODE_ENV: z.enum(["development", "test", "production"]).optional(),
      SERVICE_NAME: z.string().min(1).optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
    skipValidation,
  });
}
