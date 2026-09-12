import { expect, test, vi } from "vitest";
import { createRestTasksClient } from "./cloud-tasks.ts";

function sampleTask(parent: string, rawBody = "{}", name?: string) {
  return {
    parent,
    task: {
      ...(name ? { name } : {}),
      httpRequest: {
        httpMethod: "POST" as const,
        url: "https://worker.example.run.app/jobs",
        headers: { "x-worker-secret": "secret" },
        body: Buffer.from(rawBody),
        oidcToken: {
          serviceAccountEmail: "tasks@proj.iam",
          audience: "https://worker.example.run.app",
        },
      },
      dispatchDeadline: { seconds: 1800 },
    },
  };
}

test("REST クライアントは Tasks API に base64 body を送る", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
  const client = createRestTasksClient(async () => "tok", fetchFn);
  const parent = client.queuePath("proj", "asia-northeast1", "jobs");
  const rawBody = JSON.stringify({ event_id: "Ev1" });
  await client.createTask(sampleTask(parent, rawBody, `${parent}/tasks/Ev1`));
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
    client.createTask(sampleTask("projects/p/locations/l/queues/q")),
  ).rejects.toMatchObject({
    code: 6,
  });
});

test("REST の 5xx は失敗にする", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("boom", { status: 503 }));
  const client = createRestTasksClient(async () => "tok", fetchFn);
  await expect(client.createTask(sampleTask("projects/p/locations/l/queues/q"))).rejects.toThrow(
    /Cloud Tasks createTask failed: 503/,
  );
});
