import { expect, test, vi } from "vitest";
import { GitHubApiError, githubGraphql, githubRequest } from "./github-request.ts";

test("空の成功応答は undefined", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("", { status: 200 }));
  await expect(
    githubRequest(fetchFn, "tok", "https://example.com", { method: "GET" }),
  ).resolves.toBe(undefined);
});

test("不正な JSON は GitHubApiError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("not-json", { status: 200 }));
  await expect(
    githubRequest(fetchFn, "tok", "https://example.com", { method: "GET" }),
  ).rejects.toThrow("invalid JSON");
});

test("GraphQL の errors が message 無しでも失敗する", async () => {
  const fetchFn = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify({ errors: [{}] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const error = await githubGraphql(fetchFn, "tok", "query", {}).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(GitHubApiError);
  expect(String(error)).toContain("GraphQL error");
});

test("GraphQL の payload がオブジェクトでないと失敗する", async () => {
  const fetchFn = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(["nope"]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  await expect(githubGraphql(fetchFn, "tok", "query", {})).rejects.toThrow("invalid payload");
});
