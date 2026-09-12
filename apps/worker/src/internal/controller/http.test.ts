import { expect, test } from "vitest";
import { handleRequest, type HttpDeps } from "./http.ts";
import { createMemoryJobStore } from "../../../../../test/memory-job-store.ts";
import type { JobStore } from "../job-store.ts";

const secret = "dev-secret";

function deps(
  store: JobStore = createMemoryJobStore(),
  extra?: Partial<HttpDeps["accept"]>,
): HttpDeps {
  return {
    expectedSecret: secret,
    accept: { store, createSessionId: () => "sess-1", ...extra },
  };
}

function jobs(body: unknown, workerSecret: string | undefined = secret) {
  return handleRequest(
    {
      method: "POST",
      url: "/jobs",
      workerSecret,
      rawBody: typeof body === "string" ? body : JSON.stringify(body),
    },
    deps(),
  );
}

test("GET /health は ok", async () => {
  const res = await handleRequest(
    { method: "GET", url: "/health", workerSecret: undefined, rawBody: "" },
    deps(),
  );
  expect(res).toEqual({ status: 200, body: { ok: true, role: "worker" } });
});

test("GET / は health と同じ", async () => {
  const res = await handleRequest(
    { method: "GET", url: "/", workerSecret: undefined, rawBody: "" },
    deps(),
  );
  expect(res.status).toBe(200);
});

test("未知のパスは 404", async () => {
  const res = await handleRequest(
    { method: "GET", url: "/jobs", workerSecret: secret, rawBody: "" },
    deps(),
  );
  expect(res).toEqual({ status: 404, body: { error: "not_found" } });
});

test("秘密が無い POST /jobs は 401", async () => {
  const res = await handleRequest(
    {
      method: "POST",
      url: "/jobs",
      workerSecret: undefined,
      rawBody: JSON.stringify({ eventId: "e", channelId: "C1", threadTs: "1.0" }),
    },
    deps(),
  );
  expect(res).toEqual({ status: 401, body: { error: "unauthorized" } });
});

test("秘密が違う POST /jobs は 401", async () => {
  const res = await jobs({ eventId: "e", channelId: "C1", threadTs: "1.0" }, "wrong");
  expect(res).toEqual({ status: 401, body: { error: "unauthorized" } });
});

test("期待する秘密が空なら 401", async () => {
  const res = await handleRequest(
    {
      method: "POST",
      url: "/jobs",
      workerSecret: "",
      rawBody: JSON.stringify({ eventId: "e", channelId: "C1", threadTs: "1.0" }),
    },
    { expectedSecret: "", accept: { store: createMemoryJobStore() } },
  );
  expect(res.status).toBe(401);
});

test("不正な JSON は 400", async () => {
  const res = await handleRequest(
    { method: "POST", url: "/jobs", workerSecret: secret, rawBody: "{" },
    deps(),
  );
  expect(res).toEqual({ status: 400, body: { error: "invalid_json" } });
});

test("必須欠けは 400", async () => {
  const res = await jobs({ eventId: "e" });
  expect(res).toEqual({ status: 400, body: { error: "invalid_job" } });
});

test("envelope を受けて accepted", async () => {
  const store = createMemoryJobStore();
  const res = await handleRequest(
    {
      method: "POST",
      url: "/jobs?src=webhook",
      workerSecret: secret,
      rawBody: JSON.stringify({ eventId: "evt-1", channelId: "C123", threadTs: "1.0" }),
    },
    deps(store),
  );
  expect(res).toEqual({
    status: 200,
    body: { status: "accepted", eventId: "evt-1", sessionId: "sess-1", resumed: false },
  });
});

test("Slack event_callback を受けて accepted", async () => {
  const res = await handleRequest(
    {
      method: "POST",
      url: "/jobs",
      workerSecret: secret,
      rawBody: JSON.stringify({
        type: "event_callback",
        event_id: "evt-1",
        event: { channel: "C123", ts: "1.0", text: "hello wiki" },
      }),
    },
    deps(),
  );
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ status: "accepted", eventId: "evt-1" });
});

test("同一 event の再送は duplicate", async () => {
  const store = createMemoryJobStore();
  const d = deps(store);
  const req = {
    method: "POST",
    url: "/jobs",
    workerSecret: secret,
    rawBody: JSON.stringify({ eventId: "evt-1", channelId: "C123", threadTs: "1.0" }),
  };
  await handleRequest(req, d);
  const res = await handleRequest(req, d);
  expect(res).toEqual({ status: 200, body: { status: "duplicate", eventId: "evt-1" } });
});

test("lock が取れないときは 503", async () => {
  const store = createMemoryJobStore();
  await store.acquireLock("C123", "1.0", "other");
  const res = await handleRequest(
    {
      method: "POST",
      url: "/jobs",
      workerSecret: secret,
      rawBody: JSON.stringify({ eventId: "evt-1", channelId: "C123", threadTs: "1.0" }),
    },
    deps(store, { lockWaitMs: 30, lockRetryMs: 5 }),
  );
  expect(res).toEqual({ status: 503, body: { error: "lock_timeout" } });
});
