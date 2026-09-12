export type ReportKind = "feature" | "refactor" | "nfr";

export type SlashReport = {
  kind: ReportKind;
  instruction: string;
};

const kindByCommand: Record<string, ReportKind> = {
  "/feature": "feature",
  "/refactor": "refactor",
  "/nfr": "nfr",
};

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isSlackMessageTs(value: string): boolean {
  return /^\d+\.\d+$/.test(value);
}

export function slashReplyThreadTs(body: Record<string, unknown>): string | undefined {
  const ts = asNonEmptyString(body.thread_ts) ?? asNonEmptyString(body.threadTs);
  return ts && isSlackMessageTs(ts) ? ts : undefined;
}

export function parseSlashReport(body: Record<string, unknown>): SlashReport | undefined {
  const command = asNonEmptyString(body.command);
  if (!command) {
    return undefined;
  }
  const kind = kindByCommand[command];
  if (!kind) {
    return undefined;
  }
  const instruction = typeof body.text === "string" ? body.text.trim() : "";
  return { kind, instruction };
}
