import { createClient } from "redis";
import type { JobStore } from "../job-store.ts";
import { eventKey, lockKey, threadSessionKey } from "../redis-keys.ts";

const eventTtlSec = 24 * 60 * 60;
const lockTtlMs = 60 * 60 * 1000;
const sessionTtlSec = 7 * 24 * 60 * 60;

const releaseLockScript = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

type RedisCommands = {
  set(
    key: string,
    value: string,
    options?: { NX?: boolean; EX?: number; PX?: number },
  ): Promise<string | null>;
  del(key: string): Promise<unknown>;
  get(key: string): Promise<string | null>;
  eval(script: string, opts: { keys: string[]; arguments: string[] }): Promise<unknown>;
  close(): Promise<void>;
};

type RedisJobStore = JobStore & { close: () => Promise<void> };

function createRedisJobStore(client: RedisCommands): RedisJobStore {
  return {
    async claimEvent(eventId) {
      const result = await client.set(eventKey(eventId), "1", { NX: true, EX: eventTtlSec });
      return result === "OK";
    },
    async releaseEvent(eventId) {
      await client.del(eventKey(eventId));
    },
    async acquireLock(channelId, threadTs, token) {
      const result = await client.set(lockKey(channelId, threadTs), token, {
        NX: true,
        PX: lockTtlMs,
      });
      return result === "OK";
    },
    async releaseLock(channelId, threadTs, token) {
      await client.eval(releaseLockScript, {
        keys: [lockKey(channelId, threadTs)],
        arguments: [token],
      });
    },
    async getSession(channelId, threadTs) {
      return client.get(threadSessionKey(channelId, threadTs));
    },
    async saveSession(channelId, threadTs, sessionId) {
      await client.set(threadSessionKey(channelId, threadTs), sessionId, { EX: sessionTtlSec });
    },
    async close() {
      await client.close();
    },
  };
}

export async function connectRedisJobStore(url: string): Promise<RedisJobStore> {
  const client = createClient({ url });
  client.on("error", (error: unknown) => {
    console.error("redis", error);
  });
  await client.connect();
  return createRedisJobStore(client);
}
