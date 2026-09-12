import type { GitHubClient } from "../github.ts";
import type { JobStore } from "../job-store.ts";
import type { Job } from "../parse-job.ts";
import { getThreadSession } from "../query/get-thread-session.ts";

const defaultLockWaitMs = 50 * 60 * 1000;
const defaultLockRetryMs = 50;

export type AcceptJobResult =
  | { status: "duplicate"; eventId: string }
  | { status: "accepted"; eventId: string; sessionId: string; resumed: boolean };

export type AcceptJobDeps = {
  store: JobStore;
  github?: GitHubClient;
  createSessionId?: () => string;
  createLockToken?: () => string;
  sleep?: (ms: number) => Promise<void>;
  lockWaitMs?: number;
  lockRetryMs?: number;
  process?: (session: { job: Job; sessionId: string; resumed: boolean }) => Promise<void>;
};

export class LockTimeoutError extends Error {
  constructor() {
    super("lock_timeout");
    this.name = "LockTimeoutError";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withThreadLock<T>(deps: AcceptJobDeps, job: Job, run: () => Promise<T>): Promise<T> {
  const token = deps.createLockToken?.() ?? crypto.randomUUID();
  const waitMs = deps.lockWaitMs ?? defaultLockWaitMs;
  const retryMs = deps.lockRetryMs ?? defaultLockRetryMs;
  const sleep = deps.sleep ?? delay;
  const deadline = Date.now() + waitMs;

  while (Date.now() < deadline) {
    if (await deps.store.acquireLock(job.channelId, job.threadTs, token)) {
      try {
        return await run();
      } finally {
        await deps.store.releaseLock(job.channelId, job.threadTs, token);
      }
    }
    await sleep(retryMs);
  }

  throw new LockTimeoutError();
}

export async function acceptJob(job: Job, deps: AcceptJobDeps): Promise<AcceptJobResult> {
  const claimed = await deps.store.claimEvent(job.eventId);
  if (!claimed) {
    return { status: "duplicate", eventId: job.eventId };
  }

  try {
    return await withThreadLock(deps, job, async () => {
      const existing = await getThreadSession(deps.store, job.channelId, job.threadTs);
      const sessionId = existing ?? deps.createSessionId?.() ?? crypto.randomUUID();
      const resumed = existing !== null;
      if (!resumed) {
        await deps.store.saveSession(job.channelId, job.threadTs, sessionId);
      }
      await deps.process?.({ job, sessionId, resumed });
      return { status: "accepted", eventId: job.eventId, sessionId, resumed };
    });
  } catch (error) {
    await deps.store.releaseEvent(job.eventId);
    throw error;
  }
}
