import { expect, test } from "vitest";
import {
  createRedisJobStore,
  eventTtlSec,
  lockTtlMs,
  sessionTtlSec,
  type RedisCommands,
} from "./redis-job-store.ts";

function createFakeRedis() {
  const sets: Array<{ key: string; value: string; options?: object }> = [];
  const dels: string[] = [];
  const evals: Array<{ keys: string[]; arguments: string[]; script: string }> = [];
  const values = new Map<string, string>();
  let closed = false;
  let setOverride: string | null | undefined;

  const client: RedisCommands = {
    async set(key, value, options) {
      sets.push({ key, value, options });
      if (setOverride !== undefined) {
        return setOverride;
      }
      if (options?.NX && values.has(key)) {
        return null;
      }
      values.set(key, value);
      return "OK";
    },
    async del(key) {
      dels.push(key);
      values.delete(key);
    },
    async get(key) {
      return values.get(key) ?? null;
    },
    async eval(script, opts) {
      evals.push({ script, keys: opts.keys, arguments: opts.arguments });
      const key = opts.keys[0];
      if (key && values.get(key) === opts.arguments[0]) {
        values.delete(key);
        return 1;
      }
      return 0;
    },
    async close() {
      closed = true;
    },
  };

  return {
    client,
    sets,
    dels,
    evals,
    values,
    isClosed: () => closed,
    setSetOverride: (v: string | null) => {
      setOverride = v;
    },
  };
}

test("claimEvent は SET NX EX する", async () => {
  const fake = createFakeRedis();
  const store = createRedisJobStore(fake.client);
  expect(await store.claimEvent("evt-1")).toBe(true);
  expect(fake.sets[0]).toEqual({
    key: "slack:event:evt-1",
    value: "1",
    options: { NX: true, EX: eventTtlSec },
  });
});

test("claimEvent は既にあるキーなら false", async () => {
  const fake = createFakeRedis();
  const store = createRedisJobStore(fake.client);
  expect(await store.claimEvent("evt-1")).toBe(true);
  expect(await store.claimEvent("evt-1")).toBe(false);
});

test("claimEvent は Redis が null を返したら false", async () => {
  const fake = createFakeRedis();
  fake.setSetOverride(null);
  const store = createRedisJobStore(fake.client);
  expect(await store.claimEvent("evt-1")).toBe(false);
});

test("releaseEvent は event キーを消す", async () => {
  const fake = createFakeRedis();
  const store = createRedisJobStore(fake.client);
  await store.claimEvent("evt-1");
  await store.releaseEvent("evt-1");
  expect(fake.dels).toEqual(["slack:event:evt-1"]);
  expect(await store.claimEvent("evt-1")).toBe(true);
});

test("acquireLock は SET NX PX する", async () => {
  const fake = createFakeRedis();
  const store = createRedisJobStore(fake.client);
  expect(await store.acquireLock("C123", "1.0", "tok")).toBe(true);
  expect(fake.sets.at(-1)).toEqual({
    key: "slack:lock:C123:1.0",
    value: "tok",
    options: { NX: true, PX: lockTtlMs },
  });
});

test("同じ lock は取れない", async () => {
  const fake = createFakeRedis();
  const store = createRedisJobStore(fake.client);
  expect(await store.acquireLock("C123", "1.0", "a")).toBe(true);
  expect(await store.acquireLock("C123", "1.0", "b")).toBe(false);
});

test("releaseLock は一致するトークンだけ消す", async () => {
  const fake = createFakeRedis();
  const store = createRedisJobStore(fake.client);
  await store.acquireLock("C123", "1.0", "a");
  await store.releaseLock("C123", "1.0", "b");
  expect(await store.acquireLock("C123", "1.0", "c")).toBe(false);
  await store.releaseLock("C123", "1.0", "a");
  expect(await store.acquireLock("C123", "1.0", "c")).toBe(true);
  expect(fake.evals[0]?.keys).toEqual(["slack:lock:C123:1.0"]);
});

test("session を保存して読む", async () => {
  const fake = createFakeRedis();
  const store = createRedisJobStore(fake.client);
  expect(await store.getSession("C123", "1.0")).toBeNull();
  await store.saveSession("C123", "1.0", "sess-1");
  expect(await store.getSession("C123", "1.0")).toBe("sess-1");
  expect(fake.sets.at(-1)).toEqual({
    key: "slack:thread:C123:1.0",
    value: "sess-1",
    options: { EX: sessionTtlSec },
  });
});

test("空の session id も保存する", async () => {
  const fake = createFakeRedis();
  const store = createRedisJobStore(fake.client);
  await store.saveSession("C123", "1.0", "");
  expect(await store.getSession("C123", "1.0")).toBe("");
});

test("close は client を閉じる", async () => {
  const fake = createFakeRedis();
  const store = createRedisJobStore(fake.client);
  await store.close();
  expect(fake.isClosed()).toBe(true);
});
