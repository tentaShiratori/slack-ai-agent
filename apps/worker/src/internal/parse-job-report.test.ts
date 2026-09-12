import { expect, test } from "vitest";
import { parseJob } from "./parse-job.ts";

test("/feature を report にする", () => {
  expect(
    parseJob({
      command: "/feature",
      text: "add login",
      trigger_id: "trig-1",
      channel_id: "C123",
      thread_ts: "trig-1",
    }),
  ).toEqual({
    eventId: "trig-1",
    channelId: "C123",
    threadTs: "trig-1",
    report: { kind: "feature", instruction: "add login" },
  });
});

test("/refactor と /nfr も report にする", () => {
  expect(
    parseJob({
      command: "/refactor",
      text: "extract",
      trigger_id: "trig-2",
      channel_id: "C1",
      thread_ts: "2.0",
    }),
  ).toMatchObject({
    report: { kind: "refactor", instruction: "extract" },
    replyThreadTs: "2.0",
  });
  expect(
    parseJob({
      command: "/nfr",
      text: "p99",
      trigger_id: "trig-3",
      channel_id: "C1",
      thread_ts: "1710000000.1",
    }),
  ).toMatchObject({
    report: { kind: "nfr", instruction: "p99" },
    replyThreadTs: "1710000000.1",
  });
});

test("trigger_id を thread_ts にしても replyThreadTs は付けない", () => {
  expect(
    parseJob({
      command: "/feature",
      text: "x",
      trigger_id: "123.456.abc",
      channel_id: "C1",
      thread_ts: "123.456.abc",
    }).replyThreadTs,
  ).toBeUndefined();
});

test("報告以外の slash は report を付けない", () => {
  expect(
    parseJob({
      command: "/grill",
      text: "theme",
      trigger_id: "trig-1",
      channel_id: "C123",
      thread_ts: "1.0",
    }),
  ).toEqual({ eventId: "trig-1", channelId: "C123", threadTs: "1.0" });
});

test("空の指示文でも report は付ける", () => {
  expect(
    parseJob({
      command: "/feature",
      text: "  ",
      trigger_id: "trig-1",
      channel_id: "C123",
      thread_ts: "1.0",
    }).report,
  ).toEqual({ kind: "feature", instruction: "" });
});
