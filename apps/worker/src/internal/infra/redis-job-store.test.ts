import { expect, test, vi } from "vitest";
import { createClient } from "redis";
import { connectRedisJobStore } from "./redis-job-store.ts";

vi.mock("redis", () => ({
  createClient: vi.fn<() => void>(),
}));

const eventTtlSec = 24 * 60 * 60;
const lockTtlMs = 60 * 60 * 1000;
const sessionTtlSec = 7 * 24 * 60 * 60;

function createFakeRedis() {
  const sets: Array<{ key: string; value: string; options?: object }> = [];
  const dels: string[] = [];
  const evals: Array<{ keys: string[]; arguments: string[]; script: string }> = [];
  const values = new Map<string, string>();
  let closed = false;
  let setOverride: string | null | undefined;
  let connected = false;

  const client = {
    async set(key: string, value: string, options?: { NX?: boolean; EX?: number; PX?: number }) {
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
    async del(key: string) {
      dels.push(key);
      values.delete(key);
    },
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async eval(script: string, opts: { keys: string[]; arguments: string[] }) {
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
    on() {
      return client;
    },
    async connect() {
      connected = true;
    },
  };

  return {
    client,
    sets,
    dels,
    evals,
    isClosed: () => closed,
    isConnected: () => connected,
    setSetOverride: (v: string | null) => {
      setOverride = v;
    },
  };
}

async function connectFake() {
  const fake = createFakeRedis();
  vi.mocked(createClient).mockReturnValue(fake.client as never);
  const store = await connectRedisJobStore("redis://example");
  return { fake, store };
}

test("接続してから store を返す", async () => {
  const { fake } = await connectFake();
  expect(fake.isConnected()).toBe(true);
  expect(vi.mocked(createClient)).toHaveBeenCalledWith({ url: "redis://example" });
});

test("claimEvent は SET NX EX する", async () => {
  const { fake, store } = await connectFake();
  expect(await store.claimEvent("evt-1")).toBe(true);
  expect(fake.sets[0]).toEqual({
    key: "slack:event:evt-1",
    value: "1",
    options: { NX: true, EX: eventTtlSec },
  });
});

test("claimEvent は既にあるキーなら false", async () => {
  const { store } = await connectFake();
  expect(await store.claimEvent("evt-1")).toBe(true);
  expect(await store.claimEvent("evt-1")).toBe(false);
});

test("claimEvent は Redis が null を返したら false", async () => {
  const { fake, store } = await connectFake();
  fake.setSetOverride(null);
  expect(await store.claimEvent("evt-1")).toBe(false);
});

test("releaseEvent は event キーを消す", async () => {
  const { fake, store } = await connectFake();
  await store.claimEvent("evt-1");
  await store.releaseEvent("evt-1");
  expect(fake.dels).toEqual(["slack:event:evt-1"]);
  expect(await store.claimEvent("evt-1")).toBe(true);
});

test("acquireLock は SET NX PX する", async () => {
  const { fake, store } = await connectFake();
  expect(await store.acquireLock("C123", "1.0", "tok")).toBe(true);
  expect(fake.sets.at(-1)).toEqual({
    key: "slack:lock:C123:1.0",
    value: "tok",
    options: { NX: true, PX: lockTtlMs },
  });
});

test("同じ lock は取れない", async () => {
  const { store } = await connectFake();
  expect(await store.acquireLock("C123", "1.0", "a")).toBe(true);
  expect(await store.acquireLock("C123", "1.0", "b")).toBe(false);
});

test("releaseLock は一致するトークンだけ消す", async () => {
  const { fake, store } = await connectFake();
  await store.acquireLock("C123", "1.0", "a");
  await store.releaseLock("C123", "1.0", "b");
  expect(await store.acquireLock("C123", "1.0", "c")).toBe(false);
  await store.releaseLock("C123", "1.0", "a");
  expect(await store.acquireLock("C123", "1.0", "c")).toBe(true);
  expect(fake.evals[0]?.keys).toEqual(["slack:lock:C123:1.0"]);
});

test("session を保存して読む", async () => {
  const { fake, store } = await connectFake();
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
  const { store } = await connectFake();
  await store.saveSession("C123", "1.0", "");
  expect(await store.getSession("C123", "1.0")).toBe("");
});

test("close は client を閉じる", async () => {
  const { fake, store } = await connectFake();
  await store.close();
  expect(fake.isClosed()).toBe(true);
});
