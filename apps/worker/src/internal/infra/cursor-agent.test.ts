import { expect, test, vi } from "vitest";
import { createCursorPrompt } from "./cursor-agent.ts";

type PromptFn = (
  message: string,
  options: {
    apiKey: string;
    model: { id: string };
    cloud: { repos: Array<{ url: string }> };
  },
) => Promise<{ status: "finished" | "error"; result?: string }>;

const agentPrompt = vi.hoisted(() =>
  vi.fn<PromptFn>(async () => ({ status: "finished", result: '{"title":"T"}' })),
);

vi.mock("@cursor/sdk", () => ({
  Agent: { prompt: agentPrompt },
}));

const cloudOpts = {
  apiKey: "key",
  model: { id: "composer-2.5" as const },
  cloud: { repos: [{ url: "https://github.com/acme/app" }] },
};

test("owner/repo を GitHub URL にする", async () => {
  const prompt = vi.fn<PromptFn>(async () => ({ status: "finished", result: "ok" }));
  await createCursorPrompt("key", "acme/app", prompt)("organize");
  expect(prompt).toHaveBeenCalledWith("organize", cloudOpts);
});

test("空の owner/repo でも URL を組む", async () => {
  const prompt = vi.fn<PromptFn>(async () => ({ status: "finished", result: "ok" }));
  await createCursorPrompt("key", "", prompt)("x");
  expect(prompt.mock.calls[0]?.[1].cloud.repos[0]?.url).toBe("https://github.com/");
});

test("finished の本文を返す", async () => {
  const prompt = vi.fn<PromptFn>(async () => ({ status: "finished", result: '{"title":"T"}' }));
  const run = createCursorPrompt("key", "acme/app", prompt);
  await expect(run("organize")).resolves.toEqual({
    status: "finished",
    result: '{"title":"T"}',
  });
  expect(prompt).toHaveBeenCalledWith("organize", cloudOpts);
});

test("error ステータスもそのまま返す", async () => {
  const prompt = vi.fn<PromptFn>(async () => ({ status: "error" }));
  const run = createCursorPrompt("key", "acme/app", prompt);
  await expect(run("x")).resolves.toEqual({ status: "error", result: undefined });
});

test("prompt が投げた例外はそのまま上げる", async () => {
  const prompt = vi.fn<PromptFn>(async () => {
    throw new Error("unauthorized");
  });
  await expect(createCursorPrompt("key", "acme/app", prompt)("x")).rejects.toThrow("unauthorized");
});

test("defaultCursorPrompt は Agent.prompt に渡す", async () => {
  agentPrompt.mockResolvedValueOnce({ status: "finished", result: "ok" });
  await expect(createCursorPrompt("key", "acme/app")("organize")).resolves.toEqual({
    status: "finished",
    result: "ok",
  });
  expect(agentPrompt).toHaveBeenCalledWith("organize", cloudOpts);
});

test("defaultCursorPrompt の失敗はそのまま上げる", async () => {
  agentPrompt.mockRejectedValueOnce(new Error("unauthorized"));
  await expect(createCursorPrompt("key", "acme/app")("x")).rejects.toThrow("unauthorized");
});
