import { expect, test } from "vitest";
import { parseSlashReport, slashReplyThreadTs } from "./parse-slash-report.ts";

test("3 コマンドの種別と指示文を読む", () => {
  expect(parseSlashReport({ command: "/feature", text: "add login" })).toEqual({
    kind: "feature",
    instruction: "add login",
  });
  expect(parseSlashReport({ command: "/refactor", text: "split parser" })).toEqual({
    kind: "refactor",
    instruction: "split parser",
  });
  expect(parseSlashReport({ command: "/nfr", text: "latency" })).toEqual({
    kind: "nfr",
    instruction: "latency",
  });
});

test("指示文の前後空白を落とす", () => {
  expect(parseSlashReport({ command: "/feature", text: "  add login  " })?.instruction).toBe(
    "add login",
  );
});

test("text が無ければ空の指示文", () => {
  expect(parseSlashReport({ command: "/feature" })).toEqual({
    kind: "feature",
    instruction: "",
  });
  expect(parseSlashReport({ command: "/nfr", text: "   " })).toEqual({
    kind: "nfr",
    instruction: "",
  });
});

test("報告以外の command は undefined", () => {
  expect(parseSlashReport({ command: "/bug", text: "x" })).toBeUndefined();
  expect(parseSlashReport({ command: "/grill" })).toBeUndefined();
  expect(parseSlashReport({ text: "add login" })).toBeUndefined();
  expect(parseSlashReport({ command: "" })).toBeUndefined();
});

test("Slack の message ts だけ replyThreadTs にする", () => {
  expect(slashReplyThreadTs({ thread_ts: "1710000000.123456" })).toBe("1710000000.123456");
  expect(slashReplyThreadTs({ threadTs: "1.0" })).toBe("1.0");
  expect(slashReplyThreadTs({ thread_ts: "123.456.abcdef" })).toBeUndefined();
  expect(slashReplyThreadTs({ thread_ts: "trig-1" })).toBeUndefined();
  expect(slashReplyThreadTs({})).toBeUndefined();
});
