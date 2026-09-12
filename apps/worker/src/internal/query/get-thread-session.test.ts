import { expect, test } from "vitest";
import { getThreadSession } from "./get-thread-session.ts";
import { createMemoryJobStore } from "../../../../../test/memory-job-store.ts";

test("未保存のスレッドは null", async () => {
  const store = createMemoryJobStore();
  expect(await getThreadSession(store, "C123", "1.0")).toBeNull();
});

test("保存済みの session を返す", async () => {
  const store = createMemoryJobStore();
  await store.saveSession("C123", "1.0", "sess-1");
  expect(await getThreadSession(store, "C123", "1.0")).toBe("sess-1");
});

test("別スレッドの session は混ぜない", async () => {
  const store = createMemoryJobStore();
  await store.saveSession("C123", "1.0", "sess-1");
  expect(await getThreadSession(store, "C123", "2.0")).toBeNull();
  expect(await getThreadSession(store, "C999", "1.0")).toBeNull();
});
