import { expect, test } from "vitest";
import { JobParseError, parseJob } from "./parse-job.ts";

function bugValues(fields: {
  title?: string;
  reproduction?: string;
  expected?: string;
  actual?: string;
}) {
  return {
    title: { value: { value: fields.title } },
    reproduction: { value: { value: fields.reproduction } },
    expected: { value: { value: fields.expected } },
    actual: { value: { value: fields.actual } },
  };
}

test("bug view_submission を読む", () => {
  expect(
    parseJob({
      type: "view_submission",
      trigger_id: "trig-1",
      channel_id: "C123",
      thread_ts: "trig-1",
      view: {
        callback_id: "bug_report",
        private_metadata: JSON.stringify({ channel_id: "C123", thread_ts: "9.0" }),
        state: {
          values: bugValues({
            title: "ログインできない",
            reproduction: "開く",
            expected: "入る",
            actual: "落ちる",
          }),
        },
      },
    }),
  ).toEqual({
    eventId: "trig-1",
    channelId: "C123",
    threadTs: "trig-1",
    replyThreadTs: "9.0",
    bug: {
      title: "ログインできない",
      reproduction: "開く",
      expected: "入る",
      actual: "落ちる",
    },
  });
});

test("bug 以外の view は bug を付けない", () => {
  expect(
    parseJob({
      trigger_id: "trig-1",
      channel_id: "C123",
      thread_ts: "1.0",
      view: { callback_id: "other" },
    }),
  ).toEqual({ eventId: "trig-1", channelId: "C123", threadTs: "1.0" });
});

test("thread_ts が metadata に無ければ replyThreadTs も無い", () => {
  expect(
    parseJob({
      trigger_id: "trig-1",
      channel_id: "C123",
      thread_ts: "trig-1",
      view: {
        callback_id: "bug_report",
        private_metadata: JSON.stringify({ channel_id: "C123" }),
        state: {
          values: bugValues({
            title: "t",
            reproduction: "r",
            expected: "e",
            actual: "a",
          }),
        },
      },
    }).replyThreadTs,
  ).toBeUndefined();
});

test("bug の必須項目が空なら invalid_job", () => {
  expect(() =>
    parseJob({
      trigger_id: "trig-1",
      channel_id: "C123",
      thread_ts: "1.0",
      view: {
        callback_id: "bug_report",
        state: { values: bugValues({ title: "t", reproduction: "r", expected: "e" }) },
      },
    }),
  ).toThrow(JobParseError);
});
