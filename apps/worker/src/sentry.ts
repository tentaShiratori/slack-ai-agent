import * as Sentry from "@sentry/node";

let enabled = false;

function resolveDsn(dsn?: string): string {
  return (dsn ?? process.env.SENTRY_DSN ?? "").trim();
}

export function initSentry(options?: { dsn?: string; environment?: string }): boolean {
  const dsn = resolveDsn(options?.dsn);
  if (!dsn) {
    enabled = false;
    return false;
  }

  Sentry.init({
    dsn,
    environment:
      options?.environment ?? process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
  });
  enabled = true;
  return true;
}

export function captureException(error: unknown): void {
  if (!enabled) {
    return;
  }
  Sentry.captureException(error);
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!enabled) {
    return;
  }
  await Sentry.flush(timeoutMs);
}
