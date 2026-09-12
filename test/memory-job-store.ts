export function createMemoryJobStore() {
  const events = new Set<string>();
  const locks = new Map<string, string>();
  const sessions = new Map<string, string>();

  return {
    async claimEvent(eventId: string) {
      if (events.has(eventId)) {
        return false;
      }
      events.add(eventId);
      return true;
    },
    async releaseEvent(eventId: string) {
      events.delete(eventId);
    },
    async acquireLock(channelId: string, threadTs: string, token: string) {
      const key = `${channelId}:${threadTs}`;
      if (locks.has(key)) {
        return false;
      }
      locks.set(key, token);
      return true;
    },
    async releaseLock(channelId: string, threadTs: string, token: string) {
      const key = `${channelId}:${threadTs}`;
      if (locks.get(key) === token) {
        locks.delete(key);
      }
    },
    async getSession(channelId: string, threadTs: string) {
      return sessions.get(`${channelId}:${threadTs}`) ?? null;
    },
    async saveSession(channelId: string, threadTs: string, sessionId: string) {
      sessions.set(`${channelId}:${threadTs}`, sessionId);
    },
  };
}
