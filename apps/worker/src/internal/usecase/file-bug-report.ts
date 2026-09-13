import type { GitHubClient } from "../github.ts";
import type { Job } from "../parse-job.ts";
import type { SlackClient } from "../slack.ts";
import type { IssueDraft } from "./organize-report.ts";

export type OrganizeBug = (bug: NonNullable<Job["bug"]>) => Promise<IssueDraft>;

export type FileBugReportDeps = {
  github: GitHubClient;
  slack: SlackClient;
  organize: OrganizeBug;
  onError?: (error: unknown) => void;
};

const bugReportErrorText = "報告の作成に失敗しました";

function bugReportSuccessText(url: string): string {
  return `Issue を作成しました: ${url}`;
}

async function replyError(job: Job, deps: FileBugReportDeps): Promise<void> {
  try {
    await deps.slack.postMessage({
      channelId: job.channelId,
      threadTs: job.replyThreadTs,
      text: bugReportErrorText,
    });
  } catch (error) {
    deps.onError?.(error);
  }
}

export async function fileBugReport(job: Job, deps: FileBugReportDeps): Promise<void> {
  if (!job.bug) {
    return;
  }
  try {
    const draft = await deps.organize(job.bug);
    const issue = await deps.github.createIssue({
      title: draft.title,
      body: draft.body,
      labels: draft.labels,
    });
    await deps.github.addIssueToProject(issue.nodeId);
    await deps.slack.postMessage({
      channelId: job.channelId,
      threadTs: job.replyThreadTs,
      text: bugReportSuccessText(issue.url),
    });
  } catch (error) {
    deps.onError?.(error);
    await replyError(job, deps);
  }
}
