import { JWT } from "google-auth-library";
import {
  cloudTasksConfigFromEnv,
  createCloudTasksDispatcher,
  createRestTasksClient,
  missingKeys,
  tasksOnlyKeys,
  type TasksClientLike,
} from "../infra/gcp/cloud-tasks.ts";
import { createHttpDispatcher } from "../infra/gcp/http-dispatch.ts";

const cloudTasksScope = "https://www.googleapis.com/auth/cloud-tasks";

type JobDispatcher = (rawBody: string) => Promise<void>;

type DispatcherDeps = {
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

function createJobDispatcher(
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

function hasDispatcherDeps(deps: DispatcherDeps): boolean {
  return (
    deps.tasksClient !== undefined ||
    deps.fetchFn !== undefined ||
    deps.getAccessToken !== undefined
  );
}

export async function enqueueJob(
  rawBody: string,
  env: NodeJS.Dict<string> = process.env,
  deps: DispatcherDeps = {},
): Promise<void> {
  if (hasDispatcherDeps(deps)) {
    await createJobDispatcher(env, deps)(rawBody);
    return;
  }
  if (!cached) {
    cached = createJobDispatcher(env, deps);
  }
  await cached(rawBody);
}
