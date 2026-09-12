import { parseSlashReport, slashReplyThreadTs, type SlashReport } from "./parse-slash-report.ts";

export type Job = {
  eventId: string;
  channelId: string;
  threadTs: string;
  replyThreadTs?: string;
  report?: SlashReport;
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
  const replyThreadTs = report ? slashReplyThreadTs(record) : undefined;
  return {
    eventId,
    channelId,
    threadTs,
    ...(replyThreadTs ? { replyThreadTs } : {}),
    ...(report ? { report } : {}),
  };
}
