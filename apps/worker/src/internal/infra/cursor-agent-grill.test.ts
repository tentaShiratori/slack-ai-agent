import { expect, test, vi } from "vitest";
import { createCursorGrill, type CursorGrillSdk } from "./cursor-agent.ts";

type WaitResult = { status: string; result?: string };

const cloudOpts = {
  apiKey: "key",
  model: { id: "composer-2.5" as const },
  cloud: { repos: [{ url: "https://github.com/acme/app" }] },
};

const agentCreate = vi.hoisted(() => vi.fn());
const agentResume = vi.hoisted(() => vi.fn());

vi.mock("@cursor/sdk", () => ({
  Agent: { create: agentCreate, resume: agentResume },
}));

function fakeAgent(id: string, result: WaitResult) {
  return {
    agentId: id,
    async send() {
      return { wait: async () => result };
    },
    async [Symbol.asyncDispose]() {},
  };
}

function sdk(result: WaitResult = { status: "finished", result: '{"status":"continue","message":"Q1"}' }): CursorGrillSdk & {
  create: ReturnType<typeof vi.fn<CursorGrillSdk["create"]>>;
  resume: ReturnType<typeof vi.fn<CursorGrillSdk["resume"]>>;
} {
  const agent = fakeAgent("bc-1", result);
  return {
    create: vi.fn<CursorGrillSdk["create"]>(async () => agent),
    resume: vi.fn<CursorGrillSdk["resume"]>(async () => agent),
  };
}

test("agentId が無ければ create する", async () => {
  const grillSdk = sdk();
  await expect(
    createCursorGrill("key", "acme/app", grillSdk)({ message: "start" }),
  ).resolves.toEqual({
    agentId: "bc-1",
    text: '{"status":"continue","message":"Q1"}',
  });
  expect(grillSdk.create).toHaveBeenCalledWith(cloudOpts);
  expect(grillSdk.resume).not.toHaveBeenCalled();
});

test("agentId があれば resume する", async () => {
  const grillSdk = sdk();
  await createCursorGrill("key", "acme/app", grillSdk)({ agentId: "bc-1", message: "next" });
  expect(grillSdk.resume).toHaveBeenCalledWith("bc-1", cloudOpts);
  expect(grillSdk.create).not.toHaveBeenCalled();
});

test("finished 以外や本文無しは失敗する", async () => {
  await expect(
    createCursorGrill("key", "acme/app", sdk({ status: "error", result: "x" }))({ message: "x" }),
  ).rejects.toThrow("grill_failed");
  await expect(
    createCursorGrill("key", "acme/app", sdk({ status: "finished" }))({ message: "x" }),
  ).rejects.toThrow("grill_failed");
});

test("create が投げた例外はそのまま上げる", async () => {
  const grillSdk = sdk();
  grillSdk.create.mockRejectedValueOnce(new Error("unauthorized"));
  await expect(createCursorGrill("key", "acme/app", grillSdk)({ message: "x" })).rejects.toThrow(
    "unauthorized",
  );
});

test("default SDK は Agent.create に渡す", async () => {
  agentCreate.mockResolvedValueOnce(
    fakeAgent("bc-9", { status: "finished", result: "ok" }),
  );
  await expect(createCursorGrill("key", "acme/app")({ message: "start" })).resolves.toEqual({
    agentId: "bc-9",
    text: "ok",
  });
  expect(agentCreate).toHaveBeenCalledWith(cloudOpts);
});

test("default SDK の resume は Agent.resume に渡す", async () => {
  agentResume.mockResolvedValueOnce(
    fakeAgent("bc-9", { status: "finished", result: "ok" }),
  );
  await expect(
    createCursorGrill("key", "acme/app")({ agentId: "bc-9", message: "next" }),
  ).resolves.toEqual({ agentId: "bc-9", text: "ok" });
  expect(agentResume).toHaveBeenCalledWith("bc-9", cloudOpts);
});
