import { expect, test } from "vitest";
import { organizeSlashReport } from "./organize-report.ts";
import type { SlashReport } from "../parse-slash-report.ts";

const feature: SlashReport = { kind: "feature", instruction: "ログインを足す" };

async function draftFrom(result: string, report: SlashReport = feature) {
  return organizeSlashReport(report, async () => ({ status: "finished", result }));
}

test("プロンプトに種別と指示文を載せる", async () => {
  let message = "";
  await organizeSlashReport(feature, async (prompt) => {
    message = prompt;
    return { status: "finished", result: '{"title":"T","body":"B"}' };
  });
  expect(message).toContain("機能");
  expect(message).toContain("ログインを足す");
  expect(message).toContain('"labels":["feature"]');
});

test("/refactor と /nfr の種別 label をプロンプトに書く", async () => {
  let refactorPrompt = "";
  await organizeSlashReport({ kind: "refactor", instruction: "split" }, async (prompt) => {
    refactorPrompt = prompt;
    return { status: "finished", result: '{"title":"T","body":"B"}' };
  });
  expect(refactorPrompt).toContain("リファクタ");
  expect(refactorPrompt).toContain('"labels":["refactor"]');

  let nfrPrompt = "";
  await organizeSlashReport({ kind: "nfr", instruction: "p99" }, async (prompt) => {
    nfrPrompt = prompt;
    return { status: "finished", result: '{"title":"T","body":"B"}' };
  });
  expect(nfrPrompt).toContain("非機能");
  expect(nfrPrompt).toContain('"labels":["nfr"]');
});

test("JSON を Issue 下書きにする", async () => {
  await expect(
    draftFrom('{"title":"Add login","body":"## Why\\nneed it","labels":["feature"]}'),
  ).resolves.toEqual({
    title: "Add login",
    body: "## Why\nneed it",
    labels: ["feature"],
  });
});

test("fence 付き JSON を読む", async () => {
  await expect(draftFrom('```json\n{"title":"T","body":"B","labels":[]}\n```')).resolves.toEqual({
    title: "T",
    body: "B",
    labels: ["feature"],
  });
});

test("labels が無くても種別 label を付ける", async () => {
  await expect(draftFrom('{"title":"T","body":"B"}')).resolves.toMatchObject({
    labels: ["feature"],
  });
  await expect(
    draftFrom('{"title":"T","body":"B"}', { kind: "nfr", instruction: "x" }),
  ).resolves.toMatchObject({ labels: ["nfr"] });
});

test("空の title や body は失敗する", async () => {
  await expect(draftFrom('{"title":" ","body":"B"}')).rejects.toThrow("organize_failed");
  await expect(draftFrom('{"title":"T","body":""}')).rejects.toThrow("organize_failed");
});

test("配列や不正 JSON は失敗する", async () => {
  await expect(draftFrom("[]")).rejects.toThrow("organize_failed");
  await expect(draftFrom("not json")).rejects.toThrow("organize_failed");
});

test("Agent が finished 以外なら失敗する", async () => {
  await expect(
    organizeSlashReport(feature, async () => ({ status: "error", result: "{}" })),
  ).rejects.toThrow("organize_failed");
  await expect(organizeSlashReport(feature, async () => ({ status: "finished" }))).rejects.toThrow(
    "organize_failed",
  );
});
