import type { JobStore } from "../job-store.ts";

export async function getThreadSession(
  store: JobStore,
  channelId: string,
  threadTs: string,
): Promise<string | null> {
  return store.getSession(channelId, threadTs);
}
