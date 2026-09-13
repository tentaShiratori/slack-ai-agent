import type { PromptRun } from "../usecase/organize-report.ts";
import type { GrillTurn } from "../usecase/run-grill.ts";

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

type GrillAgent = {
  agentId: string;
  send(message: string): Promise<{ wait(): Promise<{ status: string; result?: string }> }>;
  [Symbol.asyncDispose](): PromiseLike<void>;
};

export type CursorGrillSdk = {
  create(options: CursorPromptOptions): Promise<GrillAgent>;
  resume(agentId: string, options: CursorPromptOptions): Promise<GrillAgent>;
};

const defaultCursorGrillSdk: CursorGrillSdk = {
  async create(options) {
    const { Agent } = await import("@cursor/sdk");
    return Agent.create(options);
  },
  async resume(agentId, options) {
    const { Agent } = await import("@cursor/sdk");
    return Agent.resume(agentId, options);
  },
};

export function createCursorGrill(
  apiKey: string,
  ownerRepo: string,
  sdk: CursorGrillSdk = defaultCursorGrillSdk,
): GrillTurn {
  const options: CursorPromptOptions = {
    apiKey,
    model: { id: "composer-2.5" },
    cloud: { repos: [{ url: githubRepoUrl(ownerRepo) }] },
  };
  return async ({ agentId, message }) => {
    await using agent = agentId ? await sdk.resume(agentId, options) : await sdk.create(options);
    const run = await agent.send(message);
    const result = await run.wait();
    if (result.status !== "finished" || !result.result) {
      throw new Error("grill_failed");
    }
    return { agentId: agent.agentId, text: result.result };
  };
}
