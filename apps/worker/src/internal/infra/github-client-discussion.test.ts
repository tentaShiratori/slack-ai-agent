import { expect, test, vi } from "vitest";
import {
  fetchBody,
  fetchUrl,
  githubConfig,
  jsonResponse,
} from "../../../../../test/github-client.ts";
import { createGitHubClient } from "./github-client.ts";
import { githubRestApiRoot } from "./github-request.ts";

function discussionOk() {
  return jsonResponse({
    data: {
      createDiscussion: {
        discussion: { id: "D_1", url: "https://github.com/acme/notes/discussions/1" },
      },
    },
  });
}

test("Discussion を env のカテゴリで作る", async () => {
  const fetchFn = vi.fn<typeof fetch>(async (input) => {
    if (fetchUrl(input) === `${githubRestApiRoot}/repos/acme/notes`) {
      return jsonResponse({ node_id: "R_notes" });
    }
    return discussionOk();
  });
  const client = createGitHubClient(githubConfig, fetchFn);
  await expect(client.createDiscussion({ title: "mtg", body: "要約" })).resolves.toEqual({
    id: "D_1",
    url: "https://github.com/acme/notes/discussions/1",
  });
  expect(fetchFn.mock.calls[0]?.[0]).toBe(`${githubRestApiRoot}/repos/acme/notes`);
  expect(fetchFn.mock.calls[1]?.[0]).toBe("https://api.github.com/graphql");
  const body = JSON.parse(fetchBody(fetchFn.mock.calls[1]?.[1])) as {
    variables: { repositoryId: string; categoryId: string; title: string; body: string };
  };
  expect(body.variables).toEqual({
    repositoryId: "R_notes",
    categoryId: "DIC_1",
    title: "mtg",
    body: "要約",
  });
});

test("Discussion のカテゴリとリポを上書きできる", async () => {
  const fetchFn = vi.fn<typeof fetch>(async (input) => {
    if (fetchUrl(input).includes("/repos/other/wiki")) {
      return jsonResponse({ node_id: "R_wiki" });
    }
    return discussionOk();
  });
  const client = createGitHubClient(githubConfig, fetchFn);
  await client.createDiscussion({
    title: "t",
    body: "b",
    repo: { owner: "other", name: "wiki" },
    categoryId: "DIC_other",
  });
  expect(fetchFn.mock.calls[0]?.[0]).toBe(`${githubRestApiRoot}/repos/other/wiki`);
  const body = JSON.parse(fetchBody(fetchFn.mock.calls[1]?.[1])) as {
    variables: { repositoryId: string; categoryId: string };
  };
  expect(body.variables.repositoryId).toBe("R_wiki");
  expect(body.variables.categoryId).toBe("DIC_other");
});

test("同じリポの node id は使い回す", async () => {
  const fetchFn = vi.fn<typeof fetch>(async (input) => {
    if (fetchUrl(input).includes("/repos/")) {
      return jsonResponse({ node_id: "R_notes" });
    }
    return discussionOk();
  });
  const client = createGitHubClient(githubConfig, fetchFn);
  await client.createDiscussion({ title: "a", body: "1" });
  await client.createDiscussion({ title: "b", body: "2" });
  const repoGets = fetchFn.mock.calls.filter(
    (call) => fetchUrl(call[0]) === `${githubRestApiRoot}/repos/acme/notes`,
  );
  expect(repoGets).toHaveLength(1);
  expect(fetchFn).toHaveBeenCalledTimes(3);
});

test("リポ応答に node_id が無いと失敗する", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ id: 1 }));
  const client = createGitHubClient(githubConfig, fetchFn);
  await expect(client.createDiscussion({ title: "t", body: "b" })).rejects.toThrow("node_id");
});

test("Discussion 応答が空なら失敗する", async () => {
  const fetchFn = vi.fn<typeof fetch>(async (input) => {
    if (fetchUrl(input).includes("/repos/")) {
      return jsonResponse({ node_id: "R_notes" });
    }
    return jsonResponse({ data: { createDiscussion: { discussion: null } } });
  });
  const client = createGitHubClient(githubConfig, fetchFn);
  await expect(client.createDiscussion({ title: "t", body: "b" })).rejects.toThrow("discussion");
});
