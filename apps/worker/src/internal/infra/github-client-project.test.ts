import { expect, test, vi } from "vitest";
import { fetchBody, githubConfig, jsonResponse } from "../../../../../test/github-client.ts";
import { createGitHubClient } from "./github-client.ts";
import { GitHubApiError } from "./github-request.ts";

test("作成した Issue を Project に追加する", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () =>
    jsonResponse({
      data: { addProjectV2ItemById: { item: { id: "PVTI_1" } } },
    }),
  );
  const client = createGitHubClient(githubConfig, fetchFn);
  await expect(client.addIssueToProject("I_12")).resolves.toEqual({ itemId: "PVTI_1" });
  expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.github.com/graphql");
  const init = fetchFn.mock.calls[0]?.[1];
  expect(init?.method).toBe("POST");
  const body = JSON.parse(fetchBody(init)) as {
    query: string;
    variables: { projectId: string; contentId: string };
  };
  expect(body.query).toContain("addProjectV2ItemById");
  expect(body.variables).toEqual({ projectId: "PVT_1", contentId: "I_12" });
});

test("Project 追加の GraphQL エラーは GitHubApiError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () =>
    jsonResponse({ errors: [{ message: "Projects not enabled" }] }),
  );
  const client = createGitHubClient(githubConfig, fetchFn);
  const error = await client.addIssueToProject("I_12").catch((e: unknown) => e);
  expect(error).toBeInstanceOf(GitHubApiError);
  expect(error).toMatchObject({ status: 200 });
  expect(String(error)).toContain("Projects not enabled");
});

test("Project 追加の 401 は GitHubApiError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ message: "bad token" }, 401));
  const client = createGitHubClient(githubConfig, fetchFn);
  await expect(client.addIssueToProject("I_12")).rejects.toMatchObject({
    name: "GitHubApiError",
    status: 401,
  });
});

test("Project 追加の応答が空なら失敗する", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () =>
    jsonResponse({ data: { addProjectV2ItemById: { item: null } } }),
  );
  const client = createGitHubClient(githubConfig, fetchFn);
  await expect(client.addIssueToProject("I_12")).rejects.toThrow("project item");
});
