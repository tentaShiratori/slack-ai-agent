import { expect, test, vi } from "vitest";
import type { GitHubClient } from "../github.ts";
import type { SlackPoster } from "../infra/slack/post-message.ts";
import type { Job } from "../parse-job.ts";
import { createMemoryJobStore } from "../../../../../test/memory-job-store.ts";
import { grillSessionId } from "./parse-grill-turn.ts";
import { runGrillSession, type GrillTurn, type RunGrillDeps } from "./run-grill.ts";

const startJob: Job = {
  eventId: "trig-1",
  channelId: "C123",
  threadTs: "trig-1",
  grill: { theme: "ログイン" },
};

const threadStart: Job = {
  ...startJob,
  threadTs: "1.0",
  replyThreadTs: "1.0",
};

const replyJob: Job = {
  eventId: "evt-2",
  channelId: "C123",
  threadTs: "1.0",
  eventType: "message",
  text: "Q1 は A",
};

const discussion = { id: "D_1", url: "https://github.com/acme/app/discussions/1" };
const continueJson = '{"status":"continue","message":"❓ Q1"}';
const doneJson = '{"status":"done","title":"設計","summary":"決めた"}';

function github(extra?: Partial<GitHubClient>): GitHubClient & {
  createDiscussion: ReturnType<typeof vi.fn<GitHubClient["createDiscussion"]>>;
} {
  return {
    createIssue: vi.fn<GitHubClient["createIssue"]>(async () => {
      throw new Error("unused");
    }),
    addIssueToProject: vi.fn<GitHubClient["addIssueToProject"]>(async () => {
      throw new Error("unused");
    }),
    createDiscussion: vi.fn<GitHubClient["createDiscussion"]>(async () => discussion),
    ...extra,
  };
}

function slack(extra?: Partial<SlackPoster>): SlackPoster & {
  postMessage: ReturnType<typeof vi.fn<SlackPoster["postMessage"]>>;
} {
  return {
    postMessage: vi.fn<SlackPoster["postMessage"]>(async () => ({ ts: "9.0" })),
    ...extra,
  };
}

function deps(extra?: Partial<RunGrillDeps>): RunGrillDeps {
  return {
    sessionId: "sess-1",
    store: createMemoryJobStore(),
    github: github(),
    slack: slack(),
    turn: async () => ({ agentId: "bc-1", text: continueJson }),
    ...extra,
  };
}

test("grill でも session でもなければ何もしない", async () => {
  const d = deps();
  await expect(runGrillSession(replyJob, d)).resolves.toBe(false);
  expect(d.slack.postMessage).not.toHaveBeenCalled();
});

test("/grill で質問を投稿し session を保存する", async () => {
  const store = createMemoryJobStore();
  const d = deps({ store });
  await expect(runGrillSession(threadStart, d)).resolves.toBe(true);
  expect(d.slack.postMessage).toHaveBeenCalledWith({
    channelId: "C123",
    threadTs: "1.0",
    text: "❓ Q1",
  });
  expect(await store.getSession("C123", "1.0")).toBe(grillSessionId("bc-1"));
});

test("チャンネルの /grill は投稿 ts に session を載せる", async () => {
  const store = createMemoryJobStore();
  const d = deps({ store, slack: slack() });
  await runGrillSession(startJob, d);
  expect(d.slack.postMessage).toHaveBeenCalledWith({
    channelId: "C123",
    threadTs: undefined,
    text: "❓ Q1",
  });
  expect(await store.getSession("C123", "9.0")).toBe(grillSessionId("bc-1"));
});

test("スレッド返信が同一 session で次ラウンドになる", async () => {
  const turn = vi.fn<GrillTurn>(async () => ({ agentId: "bc-1", text: continueJson }));
  const d = deps({ sessionId: grillSessionId("bc-1"), turn });
  await expect(runGrillSession(replyJob, d)).resolves.toBe(true);
  expect(turn).toHaveBeenCalledWith({
    agentId: "bc-1",
    message: expect.stringContaining("Q1 は A"),
  });
  expect(d.slack.postMessage).toHaveBeenCalledWith({
    channelId: "C123",
    threadTs: "1.0",
    text: "❓ Q1",
  });
});

test("終了したら Discussion URL を残して session を外す", async () => {
  const store = createMemoryJobStore();
  await store.saveSession("C123", "1.0", grillSessionId("bc-1"));
  const gh = github();
  const d = deps({
    sessionId: grillSessionId("bc-1"),
    store,
    github: gh,
    turn: async () => ({ agentId: "bc-1", text: doneJson }),
  });
  await runGrillSession(replyJob, d);
  expect(gh.createDiscussion).toHaveBeenCalledWith({ title: "設計", body: "決めた" });
  expect(d.slack.postMessage).toHaveBeenCalledWith({
    channelId: "C123",
    threadTs: "1.0",
    text: "Discussion を保存しました: https://github.com/acme/app/discussions/1",
  });
  expect(await store.getSession("C123", "1.0")).toBe("");
});

test("2 ラウンド往復できる", async () => {
  const store = createMemoryJobStore();
  const turn = vi
    .fn<GrillTurn>()
    .mockResolvedValueOnce({ agentId: "bc-1", text: continueJson })
    .mockResolvedValueOnce({ agentId: "bc-1", text: continueJson })
    .mockResolvedValueOnce({ agentId: "bc-1", text: doneJson });
  const d1 = deps({ store, turn, slack: slack() });
  await runGrillSession(threadStart, d1);
  const d2 = deps({
    sessionId: grillSessionId("bc-1"),
    store,
    turn,
    slack: slack(),
    github: github(),
  });
  await runGrillSession(replyJob, d2);
  const d3 = deps({
    sessionId: grillSessionId("bc-1"),
    store,
    turn,
    slack: slack(),
    github: github(),
  });
  await runGrillSession({ ...replyJob, eventId: "evt-3", text: "終わり" }, d3);
  expect(turn).toHaveBeenCalledTimes(3);
  expect(d3.slack.postMessage.mock.calls[0]?.[0].text).toContain("Discussion を保存しました");
});

test("失敗は短いエラー返信", async () => {
  const onError = vi.fn<(error: unknown) => void>();
  const d = deps({
    turn: async () => {
      throw new Error("grill_failed");
    },
    onError,
  });
  await expect(runGrillSession(threadStart, d)).resolves.toBe(true);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(d.slack.postMessage).toHaveBeenCalledWith({
    channelId: "C123",
    threadTs: "1.0",
    text: "grilling に失敗しました",
  });
});

test("エラー返信も失敗したら onError する", async () => {
  const onError = vi.fn<(error: unknown) => void>();
  await runGrillSession(threadStart, {
    ...deps({
      turn: async () => {
        throw new Error("boom");
      },
      onError,
    }),
    slack: slack({
      postMessage: vi.fn<SlackPoster["postMessage"]>(async () => {
        throw new Error("slack down");
      }),
    }),
  });
  expect(onError).toHaveBeenCalledTimes(2);
});
