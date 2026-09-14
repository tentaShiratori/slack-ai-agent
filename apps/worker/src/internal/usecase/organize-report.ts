import type { BugReport } from "../parse-bug.ts";
import type { ReportKind, SlashReport } from "../parse-slash-report.ts";

export type IssueDraft = {
  title: string;
  body: string;
  labels: string[];
};

export type PromptRun = (message: string) => Promise<{ status: string; result?: string }>;

const kindTitle: Record<ReportKind, string> = {
  feature: "機能",
  refactor: "リファクタ",
  nfr: "非機能",
};

function buildBugPrompt(bug: BugReport): string {
  return [
    "次の不具合報告を GitHub Issue 向けに整理してください。",
    "ファイルは読まず、JSON だけを返してください。",
    '形式: {"title":"string","body":"markdown","labels":["bug"]}',
    `タイトル: ${bug.title}`,
    `再現: ${bug.reproduction}`,
    `期待: ${bug.expected}`,
    `実際: ${bug.actual}`,
  ].join("\n");
}

function buildSlashPrompt(report: SlashReport): string {
  const label = report.kind;
  return [
    `次の${kindTitle[report.kind]}の報告を GitHub Issue 向けに整理してください。`,
    "ファイルは読まず、JSON だけを返してください。",
    `形式: {"title":"string","body":"markdown","labels":["${label}"]}`,
    "指示:",
    report.instruction,
  ].join("\n");
}

function jsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  const parsed: unknown = JSON.parse(jsonText);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("organize_failed");
  }
  return parsed as Record<string, unknown>;
}

function parseIssueDraft(raw: string, kind: string): IssueDraft {
  const parsed = jsonObject(raw);
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
  if (!title || !body) {
    throw new Error("organize_failed");
  }
  const labels = Array.isArray(parsed.labels)
    ? parsed.labels.filter(
        (label): label is string => typeof label === "string" && label.length > 0,
      )
    : [];
  if (!labels.includes(kind)) {
    labels.unshift(kind);
  }
  return { title, body, labels };
}

async function organize(message: string, kind: string, prompt: PromptRun): Promise<IssueDraft> {
  const result = await prompt(message);
  if (result.status !== "finished" || !result.result) {
    throw new Error("organize_failed");
  }
  return parseIssueDraft(result.result, kind);
}

export async function organizeBugReport(bug: BugReport, prompt: PromptRun): Promise<IssueDraft> {
  return organize(buildBugPrompt(bug), "bug", prompt);
}

export async function organizeSlashReport(
  report: SlashReport,
  prompt: PromptRun,
): Promise<IssueDraft> {
  return organize(buildSlashPrompt(report), report.kind, prompt);
}
