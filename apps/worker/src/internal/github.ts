export type GitHubRepo = {
  owner: string;
  name: string;
};

export type CreateIssueInput = {
  title: string;
  body: string;
  labels: string[];
  repo?: GitHubRepo;
};

export type CreatedIssue = {
  number: number;
  url: string;
  nodeId: string;
};

export type CreateDiscussionInput = {
  title: string;
  body: string;
  repo?: GitHubRepo;
  categoryId?: string;
};

export type CreatedDiscussion = {
  id: string;
  url: string;
};

export type GitHubClient = {
  createIssue(input: CreateIssueInput): Promise<CreatedIssue>;
  addIssueToProject(issueNodeId: string): Promise<{ itemId: string }>;
  createDiscussion(input: CreateDiscussionInput): Promise<CreatedDiscussion>;
};
