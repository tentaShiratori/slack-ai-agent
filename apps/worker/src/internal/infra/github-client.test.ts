import { expect, test, vi } from "vitest";
import { githubConfig, issueResponse, jsonResponse } from "../../../../../test/github-client.ts";
import { GitHubApiError, githubRestApiRoot } from "./github-request.ts";
import { createGitHubClient, githubConfigFromEnv } from "./github-client.ts";

test("owner/repo を分割する", () => {
  const config = githubConfigFromEnv({
    GITHUB_PAT: "pat",
    GITHUB_DEFAULT_REPO: "acme/app",
    GITHUB_PROJECT_ID: "PVT_1",
    GITHUB_DISCUSSION_CATEGORY_ID: "DIC_1",
  });
  expect(config.defaultRepo).toEqual({ owner: "acme", name: "app" });
});

test("owner/repo 以外は失敗する", () => {
  const base = {
    GITHUB_PAT: "pat",
    GITHUB_PROJECT_ID: "PVT_1",
    GITHUB_DISCUSSION_CATEGORY_ID: "DIC_1",
  };
  expect(() => githubConfigFromEnv({ ...base, GITHUB_DEFAULT_REPO: "acme" })).toThrow("owner/repo");
  expect(() => githubConfigFromEnv({ ...base, GITHUB_DEFAULT_REPO: "acme/app/extra" })).toThrow(
    "owner/repo",
  );
  expect(() => githubConfigFromEnv({ ...base, GITHUB_DEFAULT_REPO: "/app" })).toThrow("owner/repo");
  expect(() => githubConfigFromEnv({ ...base, GITHUB_DEFAULT_REPO: "acme/" })).toThrow(
    "owner/repo",
  );
  expect(() => githubConfigFromEnv({ ...base, GITHUB_DEFAULT_REPO: "" })).toThrow("owner/repo");
});

test("DISCUSSION_REPO が無ければ default repo を使う", () => {
  const config = githubConfigFromEnv({
    GITHUB_PAT: "pat",
    GITHUB_DEFAULT_REPO: "acme/app",
    GITHUB_PROJECT_ID: "PVT_1",
    GITHUB_DISCUSSION_CATEGORY_ID: "DIC_1",
  });
  expect(config.discussionRepo).toEqual({ owner: "acme", name: "app" });
  expect(config.defaultRepo).toEqual({ owner: "acme", name: "app" });
  expect(config.token).toBe("pat");
  expect(config.projectId).toBe("PVT_1");
  expect(config.discussionCategoryId).toBe("DIC_1");
});

test("DISCUSSION_REPO があれば Discussion 用に使う", () => {
  const config = githubConfigFromEnv({
    GITHUB_PAT: "pat",
    GITHUB_DEFAULT_REPO: "acme/app",
    GITHUB_PROJECT_ID: "PVT_1",
    GITHUB_DISCUSSION_REPO: "acme/notes",
    GITHUB_DISCUSSION_CATEGORY_ID: "DIC_1",
  });
  expect(config.discussionRepo).toEqual({ owner: "acme", name: "notes" });
});

test("Issue を label 付きでデフォルトリポに作る", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse(issueResponse()));
  const client = createGitHubClient(githubConfig, fetchFn);
  const created = await client.createIssue({
    title: "バグ",
    body: "再現手順",
    labels: ["bug"],
  });
  expect(created).toEqual({
    number: 12,
    url: "https://github.com/acme/app/issues/12",
    nodeId: "I_12",
  });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(fetchFn.mock.calls[0]?.[0]).toBe(`${githubRestApiRoot}/repos/acme/app/issues`);
  const init = fetchFn.mock.calls[0]?.[1];
  expect(init?.method).toBe("POST");
  expect(init?.headers).toEqual({
    authorization: "Bearer ghp_test",
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "slack-ai-agent",
    "content-type": "application/json",
  });
  expect(init?.body).toBe(JSON.stringify({ title: "バグ", body: "再現手順", labels: ["bug"] }));
});

test("Issue のリポを上書きできる", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse(issueResponse()));
  const client = createGitHubClient(githubConfig, fetchFn);
  await client.createIssue({
    title: "t",
    body: "b",
    labels: [],
    repo: { owner: "other", name: "lib" },
  });
  expect(fetchFn.mock.calls[0]?.[0]).toBe(`${githubRestApiRoot}/repos/other/lib/issues`);
  expect(fetchFn.mock.calls[0]?.[1]?.body).toBe(
    JSON.stringify({ title: "t", body: "b", labels: [] }),
  );
});

test("Issue 作成の 422 は GitHubApiError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ message: "bad" }, 422));
  const client = createGitHubClient(githubConfig, fetchFn);
  const error = await client
    .createIssue({ title: "t", body: "b", labels: ["missing"] })
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(GitHubApiError);
  expect(error).toMatchObject({ status: 422, name: "GitHubApiError" });
  expect(String(error)).toContain("422");
});

test("Issue 応答に node_id が無いと失敗する", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () =>
    jsonResponse({ number: 1, html_url: "https://example.com/1" }),
  );
  const client = createGitHubClient(githubConfig, fetchFn);
  await expect(client.createIssue({ title: "t", body: "b", labels: [] })).rejects.toThrow(
    "node_id",
  );
});

test("Issue 応答に number が無いと失敗する", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () =>
    jsonResponse({ html_url: "https://example.com/1", node_id: "I_1" }),
  );
  const client = createGitHubClient(githubConfig, fetchFn);
  await expect(client.createIssue({ title: "t", body: "b", labels: [] })).rejects.toThrow("number");
});

test("Issue 応答がオブジェクトでないと失敗する", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse([]));
  const client = createGitHubClient(githubConfig, fetchFn);
  await expect(client.createIssue({ title: "t", body: "b", labels: [] })).rejects.toThrow(
    "issue response invalid",
  );
});

test("DISCUSSION_REPO が owner/repo でないと失敗する", () => {
  expect(() =>
    githubConfigFromEnv({
      GITHUB_PAT: "pat",
      GITHUB_DEFAULT_REPO: "acme/app",
      GITHUB_PROJECT_ID: "PVT_1",
      GITHUB_DISCUSSION_REPO: "notes",
      GITHUB_DISCUSSION_CATEGORY_ID: "DIC_1",
    }),
  ).toThrow("owner/repo");
});
