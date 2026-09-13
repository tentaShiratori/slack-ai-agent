import type { OpenBugModal } from "../infra/slack/open-bug-modal.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function mediaTypeOf(contentType: string | undefined): string {
  return contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function parseSlackBody(rawBody: string, contentType?: string): unknown {
  if (mediaTypeOf(contentType) === "application/x-www-form-urlencoded") {
    const params = new URLSearchParams(rawBody);
    const payload = params.get("payload");
    if (payload !== null) {
      return JSON.parse(payload) as unknown;
    }
    return Object.fromEntries(params.entries());
  }
  return JSON.parse(rawBody) as unknown;
}

function eventRecord(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  return isRecord(payload.event) ? payload.event : undefined;
}

function isBotEvent(event: Record<string, unknown>): boolean {
  return asNonEmptyString(event.bot_id) !== undefined || event.subtype === "bot_message";
}

export type { OpenBugModalInput } from "../infra/slack/open-bug-modal.ts";

export type ReceiveSlackOptions = {
  openBugModal?: OpenBugModal;
};

const bugModalError = {
  response_type: "ephemeral",
  text: "モーダルを開けませんでした",
};

function isBugSlash(payload: Record<string, unknown>): boolean {
  return asNonEmptyString(payload.command) === "/bug";
}

function shouldEnqueue(payload: unknown): payload is Record<string, unknown> {
  if (!isRecord(payload)) {
    return false;
  }
  if (payload.type === "url_verification") {
    return false;
  }
  if (asNonEmptyString(payload.command)) {
    return true;
  }
  if (payload.type === "view_submission") {
    return true;
  }
  if (payload.type !== "event_callback") {
    return false;
  }
  const event = eventRecord(payload);
  if (!event || isBotEvent(event)) {
    return false;
  }
  if (event.type === "app_mention") {
    return true;
  }
  return (
    event.type === "message" &&
    event.subtype == null &&
    asNonEmptyString(event.thread_ts) !== undefined
  );
}

function privateMetadata(view: Record<string, unknown> | undefined): Record<string, unknown> {
  const raw = asNonEmptyString(view?.private_metadata);
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return { channel_id: raw };
  }
}

function withJobIds(payload: Record<string, unknown>): Record<string, unknown> {
  const event = eventRecord(payload);
  const view = isRecord(payload.view) ? payload.view : undefined;
  const meta = privateMetadata(view);
  const container = isRecord(payload.container) ? payload.container : undefined;
  const channelObj = isRecord(payload.channel) ? payload.channel : undefined;
  const eventId =
    asNonEmptyString(payload.event_id) ??
    asNonEmptyString(payload.eventId) ??
    asNonEmptyString(payload.trigger_id);
  const channelId =
    asNonEmptyString(payload.channel_id) ??
    asNonEmptyString(payload.channelId) ??
    asNonEmptyString(channelObj?.id) ??
    asNonEmptyString(event?.channel) ??
    asNonEmptyString(event?.channel_id) ??
    asNonEmptyString(container?.channel_id) ??
    asNonEmptyString(meta.channel_id);
  const threadTs =
    asNonEmptyString(payload.thread_ts) ??
    asNonEmptyString(payload.threadTs) ??
    asNonEmptyString(event?.thread_ts) ??
    asNonEmptyString(event?.ts) ??
    asNonEmptyString(meta.thread_ts) ??
    asNonEmptyString(payload.trigger_id);

  return {
    ...payload,
    ...(eventId && payload.event_id === undefined ? { event_id: eventId } : {}),
    ...(channelId && payload.channel_id === undefined ? { channel_id: channelId } : {}),
    ...(threadTs && payload.thread_ts === undefined ? { thread_ts: threadTs } : {}),
  };
}

async function openBugSlash(
  payload: Record<string, unknown>,
  openBugModal: ReceiveSlackOptions["openBugModal"],
): Promise<{ status: number; body: unknown }> {
  const triggerId = asNonEmptyString(payload.trigger_id);
  const channelId = asNonEmptyString(payload.channel_id);
  if (!triggerId || !channelId || !openBugModal) {
    return { status: 200, body: bugModalError };
  }
  try {
    await openBugModal({
      triggerId,
      channelId,
      threadTs: asNonEmptyString(payload.thread_ts),
    });
  } catch {
    return { status: 200, body: bugModalError };
  }
  return { status: 200, body: { ok: true } };
}

export async function receiveSlack(
  rawBody: string,
  enqueue: (rawBody: string) => Promise<void>,
  contentType?: string,
  options: ReceiveSlackOptions = {},
): Promise<{ status: number; body: unknown }> {
  let payload: unknown;
  try {
    payload = parseSlackBody(rawBody, contentType);
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }

  if (isRecord(payload) && payload.type === "url_verification") {
    return { status: 200, body: { challenge: payload.challenge } };
  }

  if (isRecord(payload) && isBugSlash(payload)) {
    return openBugSlash(payload, options.openBugModal);
  }

  if (shouldEnqueue(payload)) {
    await enqueue(JSON.stringify(withJobIds(payload)));
  }

  return { status: 200, body: { ok: true } };
}
