import type { GitHubClient } from "../github.ts";
import type { Job } from "../parse-job.ts";
import type { SlackClient } from "../slack.ts";
import type { IssueDraft } from "./organize-report.ts";

export type OrganizeSlash = (report: NonNullable<Job["report"]>) => Promise<IssueDraft>;

export type FileReportDeps = {
  github: GitHubClient;
  slack: SlackClient;
  organize: OrganizeSlash;
  onError?: (error: unknown) => void;
};

const reportErrorText = "報告の作成に失敗しました";
const emptyInstructionText = "指示文を付けてください";

function reportSuccessText(url: string): string {
  return `Issue を作成しました: ${url}`;
}

async function reply(job: Job, deps: FileReportDeps, text: string): Promise<void> {
  await deps.slack.postMessage({
    channelId: job.channelId,
    threadTs: job.replyThreadTs,
    text,
  });
}

async function replyError(job: Job, deps: FileReportDeps, text: string): Promise<void> {
  try {
    await reply(job, deps, text);
  } catch (error) {
    deps.onError?.(error);
  }
}

export async function fileSlashReport(job: Job, deps: FileReportDeps): Promise<void> {
  if (!job.report) {
    return;
  }
  if (!job.report.instruction) {
    await replyError(job, deps, emptyInstructionText);
    return;
  }
  try {
    const draft = await deps.organize(job.report);
    const issue = await deps.github.createIssue({
      title: draft.title,
      body: draft.body,
      labels: draft.labels,
    });
    await deps.github.addIssueToProject(issue.nodeId);
    await reply(job, deps, reportSuccessText(issue.url));
  } catch (error) {
    deps.onError?.(error);
    await replyError(job, deps, reportErrorText);
  }
}
