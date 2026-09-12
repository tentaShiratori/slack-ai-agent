import { JWT } from "google-auth-library";
import {
  cloudTasksConfigFromEnv,
  createCloudTasksDispatcher,
  createRestTasksClient,
  missingKeys,
  tasksOnlyKeys,
  type TasksClientLike,
} from "./cloud-tasks.js";
import { createHttpDispatcher } from "./http-dispatch.js";

const cloudTasksScope = "https://www.googleapis.com/auth/cloud-tasks";

export type JobDispatcher = (rawBody: string) => Promise<void>;

export type DispatcherDeps = {
  tasksClient?: TasksClientLike;
  fetchFn?: typeof fetch;
  getAccessToken?: () => Promise<string>;
};

function jwtAccessToken(credentials: {
  client_email: string;
  private_key: string;
}): () => Promise<string> {
  const jwt = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [cloudTasksScope],
  });
  return async () => {
    const result = await jwt.getAccessToken();
    if (!result.token) {
      throw new Error("failed to get Cloud Tasks access token");
    }
    return result.token;
  };
}

export function createJobDispatcher(
  env: NodeJS.Dict<string> = process.env,
  deps: DispatcherDeps = {},
): JobDispatcher {
  const missingTasksOnly = missingKeys(env, tasksOnlyKeys);
  if (missingTasksOnly.length === 0) {
    const config = cloudTasksConfigFromEnv(env);
    const client =
      deps.tasksClient ??
      createRestTasksClient(
        deps.getAccessToken ?? jwtAccessToken(config.credentials),
        deps.fetchFn ?? fetch,
      );
    return createCloudTasksDispatcher(config, client);
  }
  if (missingTasksOnly.length < tasksOnlyKeys.length) {
    throw new Error(`Cloud Tasks config missing: ${missingTasksOnly.join(", ")}`);
  }
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") {
    throw new Error("Cloud Tasks config is required on Vercel");
  }
  const workerUrl = env.WORKER_URL?.trim();
  if (!workerUrl) {
    throw new Error("WORKER_URL is required");
  }
  return createHttpDispatcher(
    { workerUrl, workerSecret: env.WORKER_SECRET ?? "" },
    deps.fetchFn ?? fetch,
  );
}

let cached: JobDispatcher | undefined;

export function resetJobDispatcherCache(): void {
  cached = undefined;
}

export async function enqueueJob(
  rawBody: string,
  env: NodeJS.Dict<string> = process.env,
  deps: DispatcherDeps = {},
): Promise<void> {
  if (!cached) {
    cached = createJobDispatcher(env, deps);
  }
  await cached(rawBody);
}
