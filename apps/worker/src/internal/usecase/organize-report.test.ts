import { expect, test } from "vitest";
import { organizeBugReport } from "./organize-report.ts";

const bug = {
  title: "ログインできない",
  reproduction: "ボタンを押す",
  expected: "入れる",
  actual: "落ちる",
};

async function draftFrom(result: string) {
  return organizeBugReport(bug, async () => ({ status: "finished", result }));
}

test("プロンプトに報告項目を載せる", async () => {
  let message = "";
  await organizeBugReport(bug, async (prompt) => {
    message = prompt;
    return { status: "finished", result: '{"title":"T","body":"B"}' };
  });
  expect(message).toContain("ログインできない");
  expect(message).toContain("ボタンを押す");
  expect(message).toContain("入れる");
  expect(message).toContain("落ちる");
  expect(message).toContain('"labels":["bug"]');
});

test("JSON を Issue 下書きにする", async () => {
  await expect(
    draftFrom('{"title":"Login fails","body":"## Repro\\nclick","labels":["bug"]}'),
  ).resolves.toEqual({
    title: "Login fails",
    body: "## Repro\nclick",
    labels: ["bug"],
  });
});

test("fence 付き JSON を読む", async () => {
  await expect(draftFrom('```json\n{"title":"T","body":"B","labels":[]}\n```')).resolves.toEqual({
    title: "T",
    body: "B",
    labels: ["bug"],
  });
});

test("labels が無くても bug を付ける", async () => {
  await expect(draftFrom('{"title":"T","body":"B"}')).resolves.toMatchObject({ labels: ["bug"] });
});

test("空の title や body は失敗する", async () => {
  await expect(draftFrom('{"title":" ","body":"B"}')).rejects.toThrow("organize_failed");
  await expect(draftFrom('{"title":"T","body":""}')).rejects.toThrow("organize_failed");
});

test("配列や不正 JSON は失敗する", async () => {
  await expect(draftFrom("[]")).rejects.toThrow("organize_failed");
  await expect(draftFrom("not json")).rejects.toThrow(SyntaxError);
});

test("Agent の結果を下書きにする", async () => {
  const draft = await organizeBugReport(bug, async () => ({
    status: "finished",
    result: '{"title":"整理題","body":"本文","labels":["bug"]}',
  }));
  expect(draft).toEqual({ title: "整理題", body: "本文", labels: ["bug"] });
});

test("Agent が finished 以外なら失敗する", async () => {
  await expect(
    organizeBugReport(bug, async () => ({ status: "error", result: "{}" })),
  ).rejects.toThrow("organize_failed");
  await expect(organizeBugReport(bug, async () => ({ status: "finished" }))).rejects.toThrow(
    "organize_failed",
  );
});
