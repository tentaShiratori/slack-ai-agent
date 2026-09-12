import { expect, test } from "vitest";
import { createMemoryJobStore } from "../../../../../test/memory-job-store.ts";
import { acceptJob, LockTimeoutError } from "./accept-job.ts";
import type { Job } from "../parse-job.ts";

const jobA: Job = { eventId: "evt-a", channelId: "C123", threadTs: "1.0" };
const jobB: Job = { eventId: "evt-b", channelId: "C123", threadTs: "1.0" };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (predicate()) {
      return;
    }
    await delay(10);
  }
  throw new Error("waitUntil timeout");
}

test("初回は session を保存して accepted", async () => {
  const store = createMemoryJobStore();
  const result = await acceptJob(jobA, { store, createSessionId: () => "sess-1" });
  expect(result).toEqual({
    status: "accepted",
    eventId: "evt-a",
    sessionId: "sess-1",
    resumed: false,
  });
  expect(await store.getSession("C123", "1.0")).toBe("sess-1");
});

test("同一 event id は duplicate", async () => {
  const store = createMemoryJobStore();
  await acceptJob(jobA, { store, createSessionId: () => "sess-1" });
  const result = await acceptJob(jobA, { store, createSessionId: () => "sess-2" });
  expect(result).toEqual({ status: "duplicate", eventId: "evt-a" });
});

test("同一スレッドの別 event は session を再開する", async () => {
  const store = createMemoryJobStore();
  await acceptJob(jobA, { store, createSessionId: () => "sess-1" });
  const result = await acceptJob(jobB, { store, createSessionId: () => "sess-2" });
  expect(result).toEqual({
    status: "accepted",
    eventId: "evt-b",
    sessionId: "sess-1",
    resumed: true,
  });
});

test("別スレッドは別 session", async () => {
  const store = createMemoryJobStore();
  await acceptJob(jobA, { store, createSessionId: () => "sess-1" });
  const result = await acceptJob(
    { eventId: "evt-c", channelId: "C123", threadTs: "2.0" },
    { store, createSessionId: () => "sess-2" },
  );
  expect(result).toEqual({
    status: "accepted",
    eventId: "evt-c",
    sessionId: "sess-2",
    resumed: false,
  });
});

test("同一スレッドの並行実行は直列化する", async () => {
  const store = createMemoryJobStore();
  const started: string[] = [];
  const finished: string[] = [];
  let releaseFirst: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = acceptJob(jobA, {
    store,
    lockRetryMs: 5,
    process: async () => {
      started.push("a");
      await gate;
      finished.push("a");
    },
  });
  await waitUntil(() => started.includes("a"));

  const second = acceptJob(jobB, {
    store,
    lockRetryMs: 5,
    process: async () => {
      started.push("b");
      finished.push("b");
    },
  });
  await delay(20);
  expect(started).toEqual(["a"]);

  releaseFirst();
  const results = await Promise.all([first, second]);
  expect(finished).toEqual(["a", "b"]);
  expect(results.map((item) => item.status)).toEqual(["accepted", "accepted"]);
});

test("処理中の同一 event は lock を待たず duplicate", async () => {
  const store = createMemoryJobStore();
  let started = false;
  let releaseFirst: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const first = acceptJob(jobA, {
    store,
    process: async () => {
      started = true;
      await gate;
    },
  });
  await waitUntil(() => started);
  const duplicate = await acceptJob(jobA, { store, lockWaitMs: 2000 });
  expect(duplicate).toEqual({ status: "duplicate", eventId: "evt-a" });
  releaseFirst();
  await first;
});

test("lock が取れないと event を開放して再実行できる", async () => {
  const store = createMemoryJobStore();
  await store.acquireLock("C123", "1.0", "other");
  await expect(
    acceptJob(jobA, { store, lockWaitMs: 30, lockRetryMs: 5, sleep: delay }),
  ).rejects.toBeInstanceOf(LockTimeoutError);
  await store.releaseLock("C123", "1.0", "other");
  const result = await acceptJob(jobA, { store, createSessionId: () => "sess-1" });
  expect(result).toEqual({
    status: "accepted",
    eventId: "evt-a",
    sessionId: "sess-1",
    resumed: false,
  });
});

test("process 失敗時は event と lock を開放する", async () => {
  const store = createMemoryJobStore();
  await expect(
    acceptJob(jobA, {
      store,
      process: async () => {
        throw new Error("boom");
      },
    }),
  ).rejects.toThrow("boom");
  expect(await store.acquireLock("C123", "1.0", "next")).toBe(true);
  await store.releaseLock("C123", "1.0", "next");
  const result = await acceptJob(jobA, { store, createSessionId: () => "sess-1" });
  expect(result.status).toBe("accepted");
});
