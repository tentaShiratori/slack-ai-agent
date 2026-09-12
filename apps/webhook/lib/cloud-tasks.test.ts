import { expect, test, vi } from "vitest";
import {
  cloudTasksConfigFromEnv,
  createCloudTasksDispatcher,
  createRestTasksClient,
  isAlreadyExistsError,
  queuePath,
  taskIdFromBody,
  type TasksClientLike,
} from "./cloud-tasks.ts";

const tasksEnv = {
  GCP_PROJECT_ID: "proj",
  CLOUD_TASKS_LOCATION: "asia-northeast1",
  CLOUD_TASKS_QUEUE: "slack-ai-agent-jobs",
  CLOUD_TASKS_INVOKER_SA: "tasks@proj.iam.gserviceaccount.com",
  GCP_TASKS_SA_KEY: JSON.stringify({
    client_email: "enqueue@proj.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\\nline\\n-----END PRIVATE KEY-----\\n",
  }),
  WORKER_URL: "https://worker.example.run.app",
  WORKER_SECRET: "secret",
};

function fakeTasksClient() {
  const createTask = vi.fn<(request: Parameters<TasksClientLike["createTask"]>[0]) => Promise<unknown>>(
    async () => ({}),
  );
  const client: TasksClientLike = {
    queuePath: (project, location, queue) => `projects/${project}/locations/${location}/queues/${queue}`,
    createTask,
  };
  return { client, createTask };
}

test("event_id をタスク ID にする", () => {
  expect(taskIdFromBody(JSON.stringify({ event_id: "EvABC" }))).toBe("EvABC");
});

test("trigger_id のドットはアンダースコアにする", () => {
  expect(taskIdFromBody(JSON.stringify({ trigger_id: "123.456" }))).toBe("123_456");
});

test("JSON でなければタスク ID なし", () => {
  expect(taskIdFromBody("not-json")).toBeUndefined();
  expect(taskIdFromBody("[]")).toBeUndefined();
  expect(taskIdFromBody(JSON.stringify({}))).toBeUndefined();
});

test("ALREADY_EXISTS を判定する", () => {
  expect(isAlreadyExistsError({ code: 6 })).toBe(true);
  expect(isAlreadyExistsError({ code: "ALREADY_EXISTS" })).toBe(true);
  expect(isAlreadyExistsError({ code: 5 })).toBe(false);
  expect(isAlreadyExistsError("nope")).toBe(false);
});

test("Cloud Tasks は POST /jobs を積んで完了を待たない", async () => {
  const { client, createTask } = fakeTasksClient();
  const enqueue = createCloudTasksDispatcher(cloudTasksConfigFromEnv(tasksEnv), client);
  const rawBody = JSON.stringify({ event_id: "Ev1", event: { channel: "C1", ts: "1.0" } });
  await enqueue(rawBody);

  expect(createTask).toHaveBeenCalledTimes(1);
  const request = createTask.mock.calls[0]?.[0];
  expect(request?.parent).toBe("projects/proj/locations/asia-northeast1/queues/slack-ai-agent-jobs");
  expect(request?.task.name).toBe(
    "projects/proj/locations/asia-northeast1/queues/slack-ai-agent-jobs/tasks/Ev1",
  );
  expect(request?.task.httpRequest).toMatchObject({
    httpMethod: "POST",
    url: "https://worker.example.run.app/jobs",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": "secret",
    },
    oidcToken: {
      serviceAccountEmail: "tasks@proj.iam.gserviceaccount.com",
      audience: "https://worker.example.run.app",
    },
  });
  expect(request?.task.httpRequest.body.toString("utf8")).toBe(rawBody);
  expect(request?.task.dispatchDeadline).toEqual({ seconds: 1800 });
});

test("同じタスクが既にあるときは成功にする", async () => {
  const { client, createTask } = fakeTasksClient();
  createTask.mockRejectedValueOnce({ code: 6 });
  const enqueue = createCloudTasksDispatcher(cloudTasksConfigFromEnv(tasksEnv), client);
  await expect(enqueue(JSON.stringify({ eventId: "e1" }))).resolves.toBeUndefined();
});

test("Tasks の他の失敗は投げる", async () => {
  const { client, createTask } = fakeTasksClient();
  createTask.mockRejectedValueOnce(new Error("quota"));
  const enqueue = createCloudTasksDispatcher(cloudTasksConfigFromEnv(tasksEnv), client);
  await expect(enqueue("{}")).rejects.toThrow("quota");
});

test("GCP_TASKS_SA_KEY が JSON でないと落とす", () => {
  expect(() => cloudTasksConfigFromEnv({ ...tasksEnv, GCP_TASKS_SA_KEY: "not-json" })).toThrow(
    "GCP_TASKS_SA_KEY must be a JSON service account key",
  );
});

test("GCP_TASKS_SA_KEY に email と key が要る", () => {
  expect(() => cloudTasksConfigFromEnv({ ...tasksEnv, GCP_TASKS_SA_KEY: "{}" })).toThrow(
    "GCP_TASKS_SA_KEY must include client_email and private_key",
  );
});

test("キーの \\n を改行に戻す", () => {
  const config = cloudTasksConfigFromEnv(tasksEnv);
  expect(config.credentials.private_key).toContain("\n");
  expect(config.credentials.private_key).not.toContain("\\n");
});

test("queuePath を組み立てる", () => {
  expect(queuePath("proj", "asia-northeast1", "jobs")).toBe(
    "projects/proj/locations/asia-northeast1/queues/jobs",
  );
});

test("REST クライアントは Tasks API に base64 body を送る", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
  const client = createRestTasksClient(async () => "tok", fetchFn);
  const parent = client.queuePath("proj", "asia-northeast1", "jobs");
  const rawBody = JSON.stringify({ event_id: "Ev1" });
  await client.createTask({
    parent,
    task: {
      name: `${parent}/tasks/Ev1`,
      httpRequest: {
        httpMethod: "POST",
        url: "https://worker.example.run.app/jobs",
        headers: { "x-worker-secret": "secret" },
        body: Buffer.from(rawBody),
        oidcToken: { serviceAccountEmail: "tasks@proj.iam", audience: "https://worker.example.run.app" },
      },
      dispatchDeadline: { seconds: 1800 },
    },
  });
  const init = fetchFn.mock.calls[0]?.[1];
  expect(fetchFn.mock.calls[0]?.[0]).toBe(
    "https://cloudtasks.googleapis.com/v2/projects/proj/locations/asia-northeast1/queues/jobs/tasks",
  );
  expect(init?.method).toBe("POST");
  expect(init?.headers).toEqual({
    authorization: "Bearer tok",
    "content-type": "application/json",
  });
  const body = init?.body;
  if (typeof body !== "string") {
    throw new Error("expected JSON body string");
  }
  const sent = JSON.parse(body) as {
    task: { dispatchDeadline: string; httpRequest: { body: string } };
  };
  expect(sent.task.dispatchDeadline).toBe("1800s");
  expect(sent.task.httpRequest.body).toBe(Buffer.from(rawBody).toString("base64"));
});

test("REST 409 は ALREADY_EXISTS にする", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("exists", { status: 409 }));
  const client = createRestTasksClient(async () => "tok", fetchFn);
  await expect(
    client.createTask({
      parent: "projects/p/locations/l/queues/q",
      task: {
        httpRequest: {
          httpMethod: "POST",
          url: "https://worker/jobs",
          headers: {},
          body: Buffer.from("{}"),
          oidcToken: { serviceAccountEmail: "sa", audience: "https://worker" },
        },
        dispatchDeadline: { seconds: 1800 },
      },
    }),
  ).rejects.toMatchObject({ code: 6 });
});

test("REST の 5xx は失敗にする", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("boom", { status: 503 }));
  const client = createRestTasksClient(async () => "tok", fetchFn);
  await expect(
    client.createTask({
      parent: "projects/p/locations/l/queues/q",
      task: {
        httpRequest: {
          httpMethod: "POST",
          url: "https://worker/jobs",
          headers: {},
          body: Buffer.from("{}"),
          oidcToken: { serviceAccountEmail: "sa", audience: "https://worker" },
        },
        dispatchDeadline: { seconds: 1800 },
      },
    }),
  ).rejects.toThrow(/Cloud Tasks createTask failed: 503/);
});
