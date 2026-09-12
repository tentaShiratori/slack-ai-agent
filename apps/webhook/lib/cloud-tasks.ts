const httpDispatchDeadlineSeconds = 1800;
const grpcAlreadyExists = 6;
const cloudTasksApiRoot = "https://cloudtasks.googleapis.com/v2";

export const tasksOnlyKeys = [
  "GCP_PROJECT_ID",
  "CLOUD_TASKS_LOCATION",
  "CLOUD_TASKS_QUEUE",
  "CLOUD_TASKS_INVOKER_SA",
  "GCP_TASKS_SA_KEY",
] as const;

export const tasksEnvKeys = [...tasksOnlyKeys, "WORKER_URL", "WORKER_SECRET"] as const;

export type CloudTasksConfig = {
  projectId: string;
  location: string;
  queue: string;
  workerUrl: string;
  workerSecret: string;
  invokerServiceAccount: string;
  credentials: { client_email: string; private_key: string };
};

export type CloudTask = {
  name?: string;
  httpRequest: {
    httpMethod: "POST";
    url: string;
    headers: Record<string, string>;
    body: Buffer;
    oidcToken: { serviceAccountEmail: string; audience: string };
  };
  dispatchDeadline: { seconds: number };
};

export type TasksClientLike = {
  queuePath: (project: string, location: string, queue: string) => string;
  createTask: (request: { parent: string; task: CloudTask }) => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function queuePath(project: string, location: string, queue: string): string {
  return `projects/${project}/locations/${location}/queues/${queue}`;
}

export function jobsUrl(workerUrl: string): string {
  return `${workerUrl.replace(/\/$/, "")}/jobs`;
}

export function taskIdFromBody(rawBody: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!isRecord(parsed)) {
      return undefined;
    }
    const id = parsed.event_id ?? parsed.eventId ?? parsed.trigger_id;
    if (typeof id !== "string" || id.length === 0) {
      return undefined;
    }
    const sanitized = id.replace(/[^A-Za-z0-9_-]/g, "_");
    if (sanitized.length === 0 || sanitized.length > 500) {
      return undefined;
    }
    return sanitized;
  } catch {
    return undefined;
  }
}

export function isAlreadyExistsError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }
  return error.code === grpcAlreadyExists || error.code === "ALREADY_EXISTS";
}

export function missingKeys(env: NodeJS.Dict<string>, keys: readonly string[]): string[] {
  return keys.filter((key) => !env[key]?.trim());
}

function parseServiceAccountKey(raw: string): { client_email: string; private_key: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GCP_TASKS_SA_KEY must be a JSON service account key");
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.client_email !== "string" ||
    typeof parsed.private_key !== "string"
  ) {
    throw new Error("GCP_TASKS_SA_KEY must include client_email and private_key");
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

export function cloudTasksConfigFromEnv(env: NodeJS.Dict<string> = process.env): CloudTasksConfig {
  const missing = missingKeys(env, tasksEnvKeys);
  if (missing.length > 0) {
    throw new Error(`Cloud Tasks config missing: ${missing.join(", ")}`);
  }
  return {
    projectId: env.GCP_PROJECT_ID ?? "",
    location: env.CLOUD_TASKS_LOCATION ?? "",
    queue: env.CLOUD_TASKS_QUEUE ?? "",
    workerUrl: env.WORKER_URL ?? "",
    workerSecret: env.WORKER_SECRET ?? "",
    invokerServiceAccount: env.CLOUD_TASKS_INVOKER_SA ?? "",
    credentials: parseServiceAccountKey(env.GCP_TASKS_SA_KEY ?? ""),
  };
}

export function createRestTasksClient(
  getAccessToken: () => Promise<string>,
  fetchFn: typeof fetch = fetch,
): TasksClientLike {
  return {
    queuePath,
    async createTask(request) {
      const response = await fetchFn(`${cloudTasksApiRoot}/${request.parent}/tasks`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${await getAccessToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          task: {
            ...(request.task.name ? { name: request.task.name } : {}),
            dispatchDeadline: `${request.task.dispatchDeadline.seconds}s`,
            httpRequest: {
              httpMethod: request.task.httpRequest.httpMethod,
              url: request.task.httpRequest.url,
              headers: request.task.httpRequest.headers,
              body: request.task.httpRequest.body.toString("base64"),
              oidcToken: request.task.httpRequest.oidcToken,
            },
          },
        }),
      });
      if (response.status === 409) {
        const error = new Error("ALREADY_EXISTS");
        (error as Error & { code: number }).code = grpcAlreadyExists;
        throw error;
      }
      if (!response.ok) {
        throw new Error(`Cloud Tasks createTask failed: ${response.status} ${await response.text()}`);
      }
    },
  };
}

export function createCloudTasksDispatcher(
  config: CloudTasksConfig,
  client: TasksClientLike,
): (rawBody: string) => Promise<void> {
  const url = jobsUrl(config.workerUrl);
  const parent = client.queuePath(config.projectId, config.location, config.queue);

  return async (rawBody: string) => {
    const taskId = taskIdFromBody(rawBody);
    try {
      await client.createTask({
        parent,
        task: {
          ...(taskId ? { name: `${parent}/tasks/${taskId}` } : {}),
          httpRequest: {
            httpMethod: "POST",
            url,
            headers: {
              "content-type": "application/json",
              "x-worker-secret": config.workerSecret,
            },
            body: Buffer.from(rawBody),
            oidcToken: {
              serviceAccountEmail: config.invokerServiceAccount,
              audience: config.workerUrl.replace(/\/$/, ""),
            },
          },
          dispatchDeadline: { seconds: httpDispatchDeadlineSeconds },
        },
      });
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        return;
      }
      throw error;
    }
  };
}
