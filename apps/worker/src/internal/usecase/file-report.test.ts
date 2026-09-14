import { expect, test, vi } from "vitest";
import type { GitHubClient } from "../github.ts";
import type { Job } from "../parse-job.ts";
import { fileSlashReport, type OrganizeSlash } from "./file-report.ts";
import type { SlackPoster } from "../infra/slack/post-message.ts";

const report = { kind: "feature" as const, instruction: "ログインを足す" };

const job: Job = {
  eventId: "trig-1",
  channelId: "C123",
  threadTs: "trig-1",
  replyThreadTs: "9.0",
  report,
};

const created = {
  number: 12,
  url: "https://github.com/acme/app/issues/12",
  nodeId: "I_12",
};
const successText = `Issue を作成しました: ${created.url}`;
const errorText = "報告の作成に失敗しました";

function github(extra?: Partial<GitHubClient>): GitHubClient & {
  createIssue: ReturnType<typeof vi.fn<GitHubClient["createIssue"]>>;
  addIssueToProject: ReturnType<typeof vi.fn<GitHubClient["addIssueToProject"]>>;
} {
  return {
    createIssue: vi.fn<GitHubClient["createIssue"]>(async () => created),
    addIssueToProject: vi.fn<GitHubClient["addIssueToProject"]>(async () => ({ itemId: "PVTI_1" })),
    createDiscussion: vi.fn<GitHubClient["createDiscussion"]>(async () => ({
      id: "D_1",
      url: "https://example.com/d",
    })),
    ...extra,
  };
}

function slack(extra?: Partial<SlackPoster>): SlackPoster & {
  postMessage: ReturnType<typeof vi.fn<SlackPoster["postMessage"]>>;
} {
  return {
    postMessage: vi.fn<SlackPoster["postMessage"]>(async () => ({ ts: "1.0" })),
    ...extra,
  };
}

test("report が無ければ何もしない", async () => {
  const gh = github();
  const sl = slack();
  const organize = vi.fn<OrganizeSlash>(async () => ({
    title: "t",
    body: "b",
    labels: ["feature"],
  }));
  await fileSlashReport(
    { eventId: "e", channelId: "C1", threadTs: "1.0" },
    {
      github: gh,
      slack: sl,
      organize,
    },
  );
  expect(organize).not.toHaveBeenCalled();
  expect(gh.createIssue).not.toHaveBeenCalled();
  expect(sl.postMessage).not.toHaveBeenCalled();
});

test("整理して Issue と Project を作り URL を返す", async () => {
  const gh = github();
  const sl = slack();
  const organize = vi.fn<OrganizeSlash>(async () => ({
    title: "整理題",
    body: "本文",
    labels: ["feature"],
  }));
  await fileSlashReport(job, { github: gh, slack: sl, organize });
  expect(organize).toHaveBeenCalledWith(report);
  expect(gh.createIssue).toHaveBeenCalledWith({
    title: "整理題",
    body: "本文",
    labels: ["feature"],
  });
  expect(gh.addIssueToProject).toHaveBeenCalledWith("I_12");
  expect(sl.postMessage).toHaveBeenCalledWith({
    channelId: "C123",
    threadTs: "9.0",
    text: successText,
  });
});

test("種別 label をそのまま Issue に渡す", async () => {
  const gh = github();
  await fileSlashReport(
    { ...job, report: { kind: "nfr", instruction: "p99" } },
    {
      github: gh,
      slack: slack(),
      organize: async () => ({ title: "t", body: "b", labels: ["nfr"] }),
    },
  );
  expect(gh.createIssue).toHaveBeenCalledWith({ title: "t", body: "b", labels: ["nfr"] });
});

test("thread が無ければチャンネルに投稿する", async () => {
  const sl = slack();
  await fileSlashReport(
    { ...job, replyThreadTs: undefined },
    {
      github: github(),
      slack: sl,
      organize: async () => ({ title: "t", body: "b", labels: ["feature"] }),
    },
  );
  expect(sl.postMessage).toHaveBeenCalledWith({
    channelId: "C123",
    threadTs: undefined,
    text: successText,
  });
});

test("空の指示文は GitHub せず短いエラー返信", async () => {
  const gh = github();
  const sl = slack();
  const organize = vi.fn<OrganizeSlash>(async () => ({
    title: "t",
    body: "b",
    labels: ["feature"],
  }));
  await fileSlashReport(
    { ...job, report: { kind: "feature", instruction: "" } },
    { github: gh, slack: sl, organize },
  );
  expect(organize).not.toHaveBeenCalled();
  expect(gh.createIssue).not.toHaveBeenCalled();
  expect(sl.postMessage).toHaveBeenCalledWith({
    channelId: "C123",
    threadTs: "9.0",
    text: "指示文を付けてください",
  });
});

test("整理失敗は短いエラー返信", async () => {
  const sl = slack();
  const onError = vi.fn<(error: unknown) => void>();
  await fileSlashReport(job, {
    github: github(),
    slack: sl,
    organize: async () => {
      throw new Error("organize_failed");
    },
    onError,
  });
  expect(onError).toHaveBeenCalledTimes(1);
  expect(sl.postMessage).toHaveBeenCalledWith({
    channelId: "C123",
    threadTs: "9.0",
    text: errorText,
  });
});

test("GitHub 失敗は短いエラー返信", async () => {
  const sl = slack();
  await fileSlashReport(job, {
    github: github({
      createIssue: vi.fn<GitHubClient["createIssue"]>(async () => {
        throw new Error("github down");
      }),
    }),
    slack: sl,
    organize: async () => ({ title: "t", body: "b", labels: ["feature"] }),
  });
  expect(sl.postMessage).toHaveBeenCalledWith({
    channelId: "C123",
    threadTs: "9.0",
    text: errorText,
  });
});

test("エラー返信も失敗したら onError する", async () => {
  const onError = vi.fn<(error: unknown) => void>();
  await fileSlashReport(job, {
    github: github({
      addIssueToProject: vi.fn<GitHubClient["addIssueToProject"]>(async () => {
        throw new Error("project");
      }),
    }),
    slack: slack({
      postMessage: vi.fn<SlackPoster["postMessage"]>(async () => {
        throw new Error("slack down");
      }),
    }),
    organize: async () => ({ title: "t", body: "b", labels: ["feature"] }),
    onError,
  });
  expect(onError).toHaveBeenCalledTimes(2);
});
