import { bugReplyThreadTs, parseBugReport, type BugReport } from "./parse-bug.ts";
import { parseSlashGrill, type SlashGrill } from "./parse-slash-grill.ts";
import { parseSlashReport, slashReplyThreadTs, type SlashReport } from "./parse-slash-report.ts";

export type Job = {
  eventId: string;
  channelId: string;
  threadTs: string;
  replyThreadTs?: string;
  report?: SlashReport;
  bug?: BugReport;
  grill?: SlashGrill;
  eventType?: string;
  text?: string;
  botId?: string;
  subtype?: string;
};

export class JobParseError extends Error {
  constructor(message = "invalid_job") {
    super(message);
    this.name = "JobParseError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseJob(body: unknown): Job {
  const record = asRecord(body);
  if (!record) {
    throw new JobParseError("invalid_job");
  }

  const event = asRecord(record.event);
  const eventId =
    asNonEmptyString(record.eventId) ??
    asNonEmptyString(record.event_id) ??
    asNonEmptyString(record.trigger_id);
  const channelId =
    asNonEmptyString(record.channelId) ??
    asNonEmptyString(record.channel_id) ??
    asNonEmptyString(record.channel) ??
    asNonEmptyString(event?.channel) ??
    asNonEmptyString(event?.channel_id);
  const threadTs =
    asNonEmptyString(record.threadTs) ??
    asNonEmptyString(record.thread_ts) ??
    asNonEmptyString(event?.thread_ts) ??
    asNonEmptyString(event?.ts);

  if (!eventId || !channelId || !threadTs) {
    throw new JobParseError("invalid_job");
  }

  const report = parseSlashReport(record);
  const grill = parseSlashGrill(record);
  let bug: BugReport | undefined;
  try {
    bug = parseBugReport(record);
  } catch {
    throw new JobParseError("invalid_job");
  }

  const replyThreadTs =
    bugReplyThreadTs(record) ?? (report || grill ? slashReplyThreadTs(record) : undefined);
  const eventType = asNonEmptyString(event?.type);
  const text = asString(event?.text) || asString(record.text);
  const botId = asNonEmptyString(event?.bot_id) ?? asNonEmptyString(record.botId);
  const subtype = asNonEmptyString(event?.subtype) ?? asNonEmptyString(record.subtype);

  return {
    eventId,
    channelId,
    threadTs,
    ...(replyThreadTs ? { replyThreadTs } : {}),
    ...(report ? { report } : {}),
    ...(bug ? { bug } : {}),
    ...(grill ? { grill } : {}),
    ...(eventType ? { eventType } : {}),
    ...(text ? { text } : {}),
    ...(botId ? { botId } : {}),
    ...(subtype ? { subtype } : {}),
  };
}
