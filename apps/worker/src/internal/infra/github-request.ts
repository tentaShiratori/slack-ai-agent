export class GitHubApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

export const githubRestApiRoot = "https://api.github.com";
const githubGraphqlUrl = "https://api.github.com/graphql";

const apiVersion = "2022-11-28";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new GitHubApiError(200, `GitHub response missing ${field}`);
  }
  return value;
}

export function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number") {
    throw new GitHubApiError(200, `GitHub response missing ${field}`);
  }
  return value;
}

export async function githubRequest(
  fetchFn: typeof fetch,
  token: string,
  url: string,
  init: { method: string; headers?: Record<string, string>; body?: string },
): Promise<unknown> {
  const response = await fetchFn(url, {
    method: init.method,
    body: init.body,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": apiVersion,
      "user-agent": "slack-ai-agent",
      ...init.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new GitHubApiError(response.status, `GitHub API ${response.status}: ${text}`);
  }
  if (text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GitHubApiError(response.status, `GitHub API invalid JSON: ${text}`);
  }
}

export async function githubGraphql(
  fetchFn: typeof fetch,
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const payload = await githubRequest(fetchFn, token, githubGraphqlUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!isRecord(payload)) {
    throw new GitHubApiError(200, "GitHub GraphQL invalid payload");
  }
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const first = payload.errors[0];
    const message =
      isRecord(first) && typeof first.message === "string" ? first.message : "GraphQL error";
    throw new GitHubApiError(200, `GitHub GraphQL: ${message}`);
  }
  return payload.data;
}
