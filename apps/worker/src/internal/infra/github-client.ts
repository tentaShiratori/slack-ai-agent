import type { CreatedDiscussion, CreatedIssue, GitHubClient, GitHubRepo } from "../github.ts";
import {
  GitHubApiError,
  githubGraphql,
  githubRequest,
  githubRestApiRoot,
  isRecord,
  requireNumber,
  requireString,
} from "./github-request.ts";

export type GitHubClientConfig = {
  token: string;
  defaultRepo: GitHubRepo;
  projectId: string;
  discussionRepo: GitHubRepo;
  discussionCategoryId: string;
};

type GitHubEnv = {
  GITHUB_PAT: string;
  GITHUB_DEFAULT_REPO: string;
  GITHUB_PROJECT_ID: string;
  GITHUB_DISCUSSION_REPO?: string;
  GITHUB_DISCUSSION_CATEGORY_ID: string;
};

const addProjectMutation = `mutation($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
    item { id }
  }
}`;

const createDiscussionMutation = `mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
  createDiscussion(input: {
    repositoryId: $repositoryId
    categoryId: $categoryId
    title: $title
    body: $body
  }) {
    discussion { id url }
  }
}`;

function parseOwnerRepo(value: string): GitHubRepo {
  const [owner, name, extra] = value.split("/");
  if (!owner || !name || extra !== undefined) {
    throw new Error(`owner/repo 形式が必要です: ${value}`);
  }
  return { owner, name };
}

export function githubConfigFromEnv(env: GitHubEnv): GitHubClientConfig {
  const defaultRepo = parseOwnerRepo(env.GITHUB_DEFAULT_REPO);
  return {
    token: env.GITHUB_PAT,
    defaultRepo,
    projectId: env.GITHUB_PROJECT_ID,
    discussionRepo: env.GITHUB_DISCUSSION_REPO
      ? parseOwnerRepo(env.GITHUB_DISCUSSION_REPO)
      : defaultRepo,
    discussionCategoryId: env.GITHUB_DISCUSSION_CATEGORY_ID,
  };
}

function repoSlug(repo: GitHubRepo): string {
  return `${repo.owner}/${repo.name}`;
}

export function createGitHubClient(
  config: GitHubClientConfig,
  fetchFn: typeof fetch = fetch,
): GitHubClient {
  const repoIds = new Map<string, string>();

  async function repositoryId(repo: GitHubRepo): Promise<string> {
    const slug = repoSlug(repo);
    const cached = repoIds.get(slug);
    if (cached) {
      return cached;
    }
    const data = await githubRequest(fetchFn, config.token, `${githubRestApiRoot}/repos/${slug}`, {
      method: "GET",
    });
    if (!isRecord(data)) {
      throw new GitHubApiError(200, "GitHub repo response invalid");
    }
    const id = requireString(data.node_id, "node_id");
    repoIds.set(slug, id);
    return id;
  }

  return {
    async createIssue(input) {
      const repo = input.repo ?? config.defaultRepo;
      const data = await githubRequest(
        fetchFn,
        config.token,
        `${githubRestApiRoot}/repos/${repoSlug(repo)}/issues`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: input.title,
            body: input.body,
            labels: input.labels,
          }),
        },
      );
      if (!isRecord(data)) {
        throw new GitHubApiError(200, "GitHub issue response invalid");
      }
      return {
        number: requireNumber(data.number, "number"),
        url: requireString(data.html_url, "html_url"),
        nodeId: requireString(data.node_id, "node_id"),
      } satisfies CreatedIssue;
    },
    async addIssueToProject(issueNodeId) {
      const data = await githubGraphql(fetchFn, config.token, addProjectMutation, {
        projectId: config.projectId,
        contentId: issueNodeId,
      });
      if (
        !isRecord(data) ||
        !isRecord(data.addProjectV2ItemById) ||
        !isRecord(data.addProjectV2ItemById.item)
      ) {
        throw new GitHubApiError(200, "GitHub project item response invalid");
      }
      return { itemId: requireString(data.addProjectV2ItemById.item.id, "item.id") };
    },
    async createDiscussion(input) {
      const repo = input.repo ?? config.discussionRepo;
      const data = await githubGraphql(fetchFn, config.token, createDiscussionMutation, {
        repositoryId: await repositoryId(repo),
        categoryId: input.categoryId ?? config.discussionCategoryId,
        title: input.title,
        body: input.body,
      });
      if (
        !isRecord(data) ||
        !isRecord(data.createDiscussion) ||
        !isRecord(data.createDiscussion.discussion)
      ) {
        throw new GitHubApiError(200, "GitHub discussion response invalid");
      }
      const discussion = data.createDiscussion.discussion;
      return {
        id: requireString(discussion.id, "discussion.id"),
        url: requireString(discussion.url, "discussion.url"),
      } satisfies CreatedDiscussion;
    },
  };
}
