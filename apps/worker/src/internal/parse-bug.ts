const bugReportCallbackId = "bug_report";

export type BugReport = {
  title: string;
  reproduction: string;
  expected: string;
  actual: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function privateMetadata(view: Record<string, unknown> | undefined): Record<string, unknown> {
  const raw = asNonEmptyString(view?.private_metadata);
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return asRecord(parsed) ?? {};
  } catch {
    return {};
  }
}

function inputValue(
  values: Record<string, unknown> | undefined,
  blockId: string,
): string | undefined {
  const block = asRecord(values?.[blockId]);
  const action = asRecord(block?.value);
  return asNonEmptyString(action?.value)?.trim();
}

function isBugSubmission(body: Record<string, unknown>): boolean {
  const view = asRecord(body.view);
  return asNonEmptyString(view?.callback_id) === bugReportCallbackId;
}

export function bugReplyThreadTs(body: Record<string, unknown>): string | undefined {
  return asNonEmptyString(privateMetadata(asRecord(body.view)).thread_ts);
}

export function parseBugReport(body: Record<string, unknown>): BugReport | undefined {
  if (!isBugSubmission(body)) {
    return undefined;
  }
  const view = asRecord(body.view);
  const state = asRecord(view?.state);
  const values = asRecord(state?.values);
  const title = inputValue(values, "title");
  const reproduction = inputValue(values, "reproduction");
  const expected = inputValue(values, "expected");
  const actual = inputValue(values, "actual");
  if (!title || !reproduction || !expected || !actual) {
    throw new Error("invalid_bug_report");
  }
  return { title, reproduction, expected, actual };
}
