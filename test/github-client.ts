export const githubConfig = {
  token: "ghp_test",
  defaultRepo: { owner: "acme", name: "app" },
  projectId: "PVT_1",
  discussionRepo: { owner: "acme", name: "notes" },
  discussionCategoryId: "DIC_1",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function fetchUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

export function fetchBody(init: RequestInit | undefined): string {
  if (typeof init?.body !== "string") {
    throw new Error("expected string body");
  }
  return init.body;
}

export function issueResponse(overrides?: {
  number?: number;
  html_url?: string;
  node_id?: string;
}) {
  return {
    number: 12,
    html_url: "https://github.com/acme/app/issues/12",
    node_id: "I_12",
    ...overrides,
  };
}
