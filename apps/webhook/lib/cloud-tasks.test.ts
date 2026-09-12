import { expect, test, vi } from "vitest";
import {
  cloudTasksConfigFromEnv,
  createCloudTasksDispatcher,
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
  const createTask = vi.fn<
    (request: Parameters<TasksClientLike["createTask"]>[0]) => Promise<unknown>
  >(async () => ({}));
  const client: TasksClientLike = {
    queuePath: (project, location, queue) =>
      `projects/${project}/locations/${location}/queues/${queue}`,
    createTask,
  };
  return { client, createTask };
}

test("event_id をタスク ID にする", async () => {
  const { client, createTask } = fakeTasksClient();
  await createCloudTasksDispatcher(
    cloudTasksConfigFromEnv(tasksEnv),
    client,
  )(JSON.stringify({ event_id: "EvABC" }));
  expect(createTask.mock.calls[0]?.[0].task.name).toBe(
    "projects/proj/locations/asia-northeast1/queues/slack-ai-agent-jobs/tasks/EvABC",
  );
});

test("trigger_id のドットはアンダースコアにする", async () => {
  const { client, createTask } = fakeTasksClient();
  await createCloudTasksDispatcher(
    cloudTasksConfigFromEnv(tasksEnv),
    client,
  )(JSON.stringify({ trigger_id: "123.456" }));
  expect(createTask.mock.calls[0]?.[0].task.name).toBe(
    "projects/proj/locations/asia-northeast1/queues/slack-ai-agent-jobs/tasks/123_456",
  );
});

test("JSON でなければタスク名を付けない", async () => {
  const { client, createTask } = fakeTasksClient();
  const enqueue = createCloudTasksDispatcher(cloudTasksConfigFromEnv(tasksEnv), client);
  await enqueue("not-json");
  await enqueue("[]");
  await enqueue("{}");
  expect(createTask.mock.calls.map((call) => call[0].task.name)).toEqual([
    undefined,
    undefined,
    undefined,
  ]);
});

test("Cloud Tasks は POST /jobs を積んで完了を待たない", async () => {
  const { client, createTask } = fakeTasksClient();
  const enqueue = createCloudTasksDispatcher(cloudTasksConfigFromEnv(tasksEnv), client);
  const rawBody = JSON.stringify({ event_id: "Ev1", event: { channel: "C1", ts: "1.0" } });
  await enqueue(rawBody);

  expect(createTask).toHaveBeenCalledTimes(1);
  const request = createTask.mock.calls[0]?.[0];
  expect(request?.parent).toBe(
    "projects/proj/locations/asia-northeast1/queues/slack-ai-agent-jobs",
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

test("ALREADY_EXISTS 文字列も成功にする", async () => {
  const { client, createTask } = fakeTasksClient();
  createTask.mockRejectedValueOnce({ code: "ALREADY_EXISTS" });
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
