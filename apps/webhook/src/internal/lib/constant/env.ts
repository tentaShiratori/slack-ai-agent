import { createWebhookEnv, shouldSkipEnvValidation } from "./create-env.js";

export const env = createWebhookEnv(process.env, shouldSkipEnvValidation(process.env));
