export function eventKey(eventId: string): string {
  return `slack:event:${eventId}`;
}

export function lockKey(channelId: string, threadTs: string): string {
  return `slack:lock:${channelId}:${threadTs}`;
}

export function threadSessionKey(channelId: string, threadTs: string): string {
  return `slack:thread:${channelId}:${threadTs}`;
}
