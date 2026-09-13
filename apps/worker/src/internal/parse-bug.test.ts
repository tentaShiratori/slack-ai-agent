import { expect, test } from "vitest";
import { bugReplyThreadTs, parseBugReport } from "./parse-bug.ts";

const complete = {
  title: "t",
  reproduction: "r",
  expected: "e",
  actual: "a",
};

function viewBody(fields: Partial<typeof complete> & { callbackId?: string; metadata?: unknown }) {
  return {
    view: {
      callback_id: fields.callbackId ?? "bug_report",
      private_metadata:
        fields.metadata === undefined
          ? undefined
          : typeof fields.metadata === "string"
            ? fields.metadata
            : JSON.stringify(fields.metadata),
      state: {
        values: {
          title: { value: { value: fields.title ?? complete.title } },
          reproduction: { value: { value: fields.reproduction ?? complete.reproduction } },
          expected: { value: { value: fields.expected ?? complete.expected } },
          actual: { value: { value: fields.actual ?? complete.actual } },
        },
      },
    },
  };
}

test("bug_report だけを bug とみなす", () => {
  expect(parseBugReport(viewBody({}))).toEqual(complete);
  expect(parseBugReport(viewBody({ callbackId: "other" }))).toBeUndefined();
  expect(parseBugReport({})).toBeUndefined();
});

test("前後空白を除いて読む", () => {
  expect(
    parseBugReport(
      viewBody({ title: "  題  ", reproduction: " r ", expected: " e ", actual: " a " }),
    ),
  ).toEqual({ title: "題", reproduction: "r", expected: "e", actual: "a" });
});

test("必須が空文字なら失敗する", () => {
  expect(() => parseBugReport(viewBody({ title: "  " }))).toThrow("invalid_bug_report");
  expect(() => parseBugReport(viewBody({ reproduction: "" }))).toThrow("invalid_bug_report");
  expect(() => parseBugReport(viewBody({ expected: "" }))).toThrow("invalid_bug_report");
  expect(() => parseBugReport(viewBody({ actual: "" }))).toThrow("invalid_bug_report");
});

test("bug でなければ undefined", () => {
  expect(parseBugReport(viewBody({ callbackId: "grill" }))).toBeUndefined();
});

test("reply thread は metadata の thread_ts だけ", () => {
  expect(bugReplyThreadTs(viewBody({ metadata: { channel_id: "C1", thread_ts: "9.0" } }))).toBe(
    "9.0",
  );
  expect(bugReplyThreadTs(viewBody({ metadata: { channel_id: "C1" } }))).toBeUndefined();
  expect(bugReplyThreadTs(viewBody({ metadata: "C1" }))).toBeUndefined();
  expect(bugReplyThreadTs(viewBody({ metadata: "{" }))).toBeUndefined();
});
