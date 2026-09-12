export type JobStore = {
  claimEvent(eventId: string): Promise<boolean>;
  releaseEvent(eventId: string): Promise<void>;
  acquireLock(channelId: string, threadTs: string, token: string): Promise<boolean>;
  releaseLock(channelId: string, threadTs: string, token: string): Promise<void>;
  getSession(channelId: string, threadTs: string): Promise<string | null>;
  saveSession(channelId: string, threadTs: string, sessionId: string): Promise<void>;
};
