import { expect, test } from "vitest";
import { parseJob } from "./parse-job.ts";

test("/grill を grill にする", () => {
  expect(
    parseJob({
      command: "/grill",
      text: "ログイン設計",
      trigger_id: "trig-1",
      channel_id: "C123",
      thread_ts: "trig-1",
    }),
  ).toEqual({
    eventId: "trig-1",
    channelId: "C123",
    threadTs: "trig-1",
    text: "ログイン設計",
    grill: { theme: "ログイン設計" },
  });
});

test("スレッドの /grill は replyThreadTs を付ける", () => {
  expect(
    parseJob({
      command: "/grill",
      text: "theme",
      trigger_id: "trig-1",
      channel_id: "C123",
      thread_ts: "1.0",
    }),
  ).toMatchObject({
    grill: { theme: "theme" },
    replyThreadTs: "1.0",
  });
});

test("テーマ無し /grill も grill を付ける", () => {
  expect(
    parseJob({
      command: "/grill",
      trigger_id: "trig-1",
      channel_id: "C123",
      thread_ts: "trig-1",
    }).grill,
  ).toEqual({ theme: "" });
});

test("スレッド返信は grill を付けない", () => {
  expect(
    parseJob({
      event_id: "evt-2",
      event: { type: "message", channel: "C1", ts: "2.0", thread_ts: "1.0", text: "答え" },
    }).grill,
  ).toBeUndefined();
});
