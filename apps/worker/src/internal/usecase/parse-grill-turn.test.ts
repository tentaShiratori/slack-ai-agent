import { expect, test } from "vitest";
import {
  buildGrillFollowUp,
  buildGrillStartPrompt,
  grillSessionId,
  parseGrillAgentId,
  parseGrillTurn,
} from "./parse-grill-turn.ts";

test("grill session id を付け外しする", () => {
  expect(grillSessionId("bc-1")).toBe("grill:bc-1");
  expect(parseGrillAgentId("grill:bc-1")).toBe("bc-1");
  expect(parseGrillAgentId("sess-1")).toBeUndefined();
  expect(parseGrillAgentId("grill:")).toBeUndefined();
  expect(parseGrillAgentId("")).toBeUndefined();
  expect(parseGrillAgentId(null)).toBeUndefined();
});

test("テーマ付き開始プロンプトを組む", () => {
  const prompt = buildGrillStartPrompt("ログイン設計");
  expect(prompt).toContain("テーマ: ログイン設計");
  expect(prompt).toContain('"status":"continue"');
  expect(prompt).toContain('"status":"done"');
});

test("テーマ無し開始プロンプトは frontier で確認する", () => {
  expect(buildGrillStartPrompt("")).toContain("テーマはまだ示されていません");
});

test("フォローアップに本文を載せる", () => {
  expect(buildGrillFollowUp("Q1 は A")).toContain("Q1 は A");
  expect(buildGrillFollowUp("")).toContain("(空の返信)");
});

test("continue JSON を読む", () => {
  expect(parseGrillTurn('{"status":"continue","message":"❓ Q1"}')).toEqual({
    status: "continue",
    message: "❓ Q1",
  });
});

test("done JSON を読む", () => {
  expect(parseGrillTurn('{"status":"done","title":"設計","summary":"決めた"}')).toEqual({
    status: "done",
    title: "設計",
    summary: "決めた",
  });
});

test("fence 付き JSON を読む", () => {
  expect(parseGrillTurn('```json\n{"status":"continue","message":"Q1"}\n```')).toEqual({
    status: "continue",
    message: "Q1",
  });
});

test("空の message / title / summary は失敗する", () => {
  expect(() => parseGrillTurn('{"status":"continue","message":" "}')).toThrow("grill_failed");
  expect(() => parseGrillTurn('{"status":"done","title":" ","summary":"s"}')).toThrow(
    "grill_failed",
  );
  expect(() => parseGrillTurn('{"status":"done","title":"t","summary":""}')).toThrow(
    "grill_failed",
  );
});

test("配列や不正 JSON は失敗する", () => {
  expect(() => parseGrillTurn("[]")).toThrow("grill_failed");
  expect(() => parseGrillTurn("not json")).toThrow("grill_failed");
  expect(() => parseGrillTurn('{"status":"maybe"}')).toThrow("grill_failed");
});
