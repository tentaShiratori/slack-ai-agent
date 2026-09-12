import type { PromptRun } from "../usecase/organize-report.ts";

type CursorPromptOptions = {
  apiKey: string;
  model: { id: string };
  cloud: { repos: Array<{ url: string }> };
};

type AgentPrompt = (
  message: string,
  options: CursorPromptOptions,
) => Promise<{ status: string; result?: string }>;

function githubRepoUrl(ownerRepo: string): string {
  return `https://github.com/${ownerRepo}`;
}

export function createCursorPrompt(
  apiKey: string,
  ownerRepo: string,
  prompt: AgentPrompt = defaultCursorPrompt,
): PromptRun {
  return async (message) => {
    const result = await prompt(message, {
      apiKey,
      model: { id: "composer-2.5" },
      cloud: { repos: [{ url: githubRepoUrl(ownerRepo) }] },
    });
    return { status: result.status, result: result.result };
  };
}

async function defaultCursorPrompt(
  message: string,
  options: CursorPromptOptions,
): Promise<{ status: string; result?: string }> {
  const { Agent } = await import("@cursor/sdk");
  const result = await Agent.prompt(message, options);
  return { status: result.status, result: result.result };
}
