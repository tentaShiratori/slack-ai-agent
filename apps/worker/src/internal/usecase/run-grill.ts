import type { GitHubClient } from "../github.ts";
import type { SlackPoster } from "../infra/slack/post-message.ts";
import type { JobStore } from "../job-store.ts";
import type { Job } from "../parse-job.ts";
import {
  buildGrillFollowUp,
  buildGrillStartPrompt,
  grillSessionId,
  parseGrillAgentId,
  parseGrillTurn,
} from "./parse-grill-turn.ts";

export type GrillTurn = (input: {
  agentId?: string;
  message: string;
}) => Promise<{ agentId: string; text: string }>;

export type RunGrillDeps = {
  sessionId: string;
  store: Pick<JobStore, "saveSession">;
  github: GitHubClient;
  slack: SlackPoster;
  turn: GrillTurn;
  onError?: (error: unknown) => void;
};

const grillErrorText = "grilling に失敗しました";

function discussionSuccessText(url: string): string {
  return `Discussion を保存しました: ${url}`;
}

function replyThreadTs(job: Job): string | undefined {
  return job.grill ? job.replyThreadTs : job.threadTs;
}

async function reply(job: Job, deps: RunGrillDeps, text: string): Promise<{ ts: string }> {
  return deps.slack.postMessage({
    channelId: job.channelId,
    threadTs: replyThreadTs(job),
    text,
  });
}

async function replyError(job: Job, deps: RunGrillDeps): Promise<void> {
  try {
    await reply(job, deps, grillErrorText);
  } catch (error) {
    deps.onError?.(error);
  }
}

async function applyTurn(
  job: Job,
  deps: RunGrillDeps,
  agentId: string,
  raw: string,
): Promise<void> {
  const result = parseGrillTurn(raw);
  if (result.status === "continue") {
    const posted = await reply(job, deps, result.message);
    const sessionThread = replyThreadTs(job) ?? posted.ts;
    await deps.store.saveSession(job.channelId, sessionThread, grillSessionId(agentId));
    return;
  }

  const discussion = await deps.github.createDiscussion({
    title: result.title,
    body: result.summary,
  });
  const posted = await reply(job, deps, discussionSuccessText(discussion.url));
  const sessionThread = replyThreadTs(job) ?? posted.ts;
  await deps.store.saveSession(job.channelId, sessionThread, "");
}

export async function runGrillSession(job: Job, deps: RunGrillDeps): Promise<boolean> {
  const resumeId = job.grill ? undefined : parseGrillAgentId(deps.sessionId);
  if (!job.grill && !resumeId) {
    return false;
  }

  try {
    const turned = await deps.turn({
      ...(resumeId ? { agentId: resumeId } : {}),
      message: job.grill ? buildGrillStartPrompt(job.grill.theme) : buildGrillFollowUp(job.text ?? ""),
    });
    await applyTurn(job, deps, turned.agentId, turned.text);
    return true;
  } catch (error) {
    deps.onError?.(error);
    await replyError(job, deps);
    return true;
  }
}
