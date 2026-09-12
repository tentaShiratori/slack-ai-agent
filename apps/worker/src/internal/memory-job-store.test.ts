import { expect, test } from "vitest";
import { createMemoryJobStore } from "../../../../test/memory-job-store.ts";

test("同じ event は二度 claim できない", async () => {
  const store = createMemoryJobStore();
  expect(await store.claimEvent("evt-1")).toBe(true);
  expect(await store.claimEvent("evt-1")).toBe(false);
});

test("release した event は再 claim できる", async () => {
  const store = createMemoryJobStore();
  await store.claimEvent("evt-1");
  await store.releaseEvent("evt-1");
  expect(await store.claimEvent("evt-1")).toBe(true);
});

test("存在しない event の release は落ちない", async () => {
  const store = createMemoryJobStore();
  await expect(store.releaseEvent("missing")).resolves.toBeUndefined();
});

test("lock はトークンが一致するときだけ外れる", async () => {
  const store = createMemoryJobStore();
  expect(await store.acquireLock("C1", "1.0", "a")).toBe(true);
  expect(await store.acquireLock("C1", "1.0", "b")).toBe(false);
  await store.releaseLock("C1", "1.0", "b");
  expect(await store.acquireLock("C1", "1.0", "b")).toBe(false);
  await store.releaseLock("C1", "1.0", "a");
  expect(await store.acquireLock("C1", "1.0", "b")).toBe(true);
});

test("別スレッドの lock は独立している", async () => {
  const store = createMemoryJobStore();
  expect(await store.acquireLock("C1", "1.0", "a")).toBe(true);
  expect(await store.acquireLock("C1", "2.0", "b")).toBe(true);
});

test("session は未保存なら null", async () => {
  const store = createMemoryJobStore();
  expect(await store.getSession("C1", "1.0")).toBeNull();
});

test("session を保存して読める", async () => {
  const store = createMemoryJobStore();
  await store.saveSession("C1", "1.0", "sess-1");
  expect(await store.getSession("C1", "1.0")).toBe("sess-1");
});

test("空文字の session も保存できる", async () => {
  const store = createMemoryJobStore();
  await store.saveSession("C1", "1.0", "");
  expect(await store.getSession("C1", "1.0")).toBe("");
});
