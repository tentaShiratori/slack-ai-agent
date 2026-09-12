import { expect, test, vi } from "vitest";
import { enqueueJob } from "./enqueue-job.ts";
import type { TasksClientLike } from "../infra/cloud-tasks.ts";

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

test("環境が揃えば Cloud Tasks を使う", async () => {
  const { client, createTask } = fakeTasksClient();
  await enqueueJob(JSON.stringify({ event_id: "Ev2" }), tasksEnv, { tasksClient: client });
  expect(createTask).toHaveBeenCalledTimes(1);
});

test("Tasks の一部だけあるときは落とす", async () => {
  await expect(
    enqueueJob("{}", { GCP_PROJECT_ID: "proj", WORKER_URL: "http://localhost:8080" }),
  ).rejects.toThrow(/Cloud Tasks config missing/);
});

test("Vercel 本番では Tasks 設定が必須", async () => {
  await expect(
    enqueueJob("{}", { VERCEL_ENV: "production", WORKER_URL: "https://worker.example.run.app" }),
  ).rejects.toThrow("Cloud Tasks config is required on Vercel");
  await expect(
    enqueueJob("{}", { VERCEL_ENV: "preview", WORKER_URL: "https://worker.example.run.app" }),
  ).rejects.toThrow("Cloud Tasks config is required on Vercel");
});

test("mise の WORKER_URL だけでは HTTP にする", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
  await enqueueJob(
    "{}",
    { WORKER_URL: "http://127.0.0.1:8080", WORKER_SECRET: "dev-secret", SKIP_SLACK_VERIFY: "1" },
    { fetchFn },
  );
  expect(fetchFn).toHaveBeenCalled();
});

test("ローカルで WORKER_URL が無いと落とす", async () => {
  await expect(enqueueJob("{}", {})).rejects.toThrow("WORKER_URL is required");
});

test("deps 付きの enqueueJob は dispatcher を使い回さない", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
  const env = { WORKER_URL: "http://127.0.0.1:8080", WORKER_SECRET: "dev" };
  await enqueueJob("{}", env, { fetchFn });
  await enqueueJob("{}", env, { fetchFn });
  expect(fetchFn).toHaveBeenCalledTimes(2);
});
