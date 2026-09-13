import { expect, test } from "vitest";
import { parseSlashGrill } from "./parse-slash-grill.ts";

test("/grill のテーマを読む", () => {
  expect(parseSlashGrill({ command: "/grill", text: "ログイン設計" })).toEqual({
    theme: "ログイン設計",
  });
});

test("テーマの前後空白を落とす", () => {
  expect(parseSlashGrill({ command: "/grill", text: "  設計  " })?.theme).toBe("設計");
});

test("text が無ければ空のテーマ", () => {
  expect(parseSlashGrill({ command: "/grill" })).toEqual({ theme: "" });
  expect(parseSlashGrill({ command: "/grill", text: "   " })).toEqual({ theme: "" });
});

test("/grill 以外は undefined", () => {
  expect(parseSlashGrill({ command: "/feature", text: "x" })).toBeUndefined();
  expect(parseSlashGrill({ command: "/bug" })).toBeUndefined();
  expect(parseSlashGrill({ text: "ログイン設計" })).toBeUndefined();
  expect(parseSlashGrill({ command: "" })).toBeUndefined();
});
