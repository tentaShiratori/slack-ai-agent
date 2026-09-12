import { createWorkerEnv, shouldSkipEnvValidation } from "./create-env.ts";

export const env = createWorkerEnv(process.env, shouldSkipEnvValidation(process.env));
