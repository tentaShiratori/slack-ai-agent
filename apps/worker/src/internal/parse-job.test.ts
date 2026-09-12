import { expect, test } from "vitest";
import { JobParseError, parseJob } from "./parse-job.ts";

test("envelope の camelCase を読む", () => {
  expect(parseJob({ eventId: "evt-1", channelId: "C123", threadTs: "1.0" })).toEqual({
    eventId: "evt-1",
    channelId: "C123",
    threadTs: "1.0",
  });
});

test("Slack event_callback を読む", () => {
  expect(
    parseJob({
      type: "event_callback",
      event_id: "evt-1",
      event: { channel: "C123", thread_ts: "2.0", ts: "1.0", text: "hello" },
    }),
  ).toEqual({ eventId: "evt-1", channelId: "C123", threadTs: "2.0" });
});

test("thread_ts が無いときは ts を使う", () => {
  expect(
    parseJob({
      event_id: "evt-1",
      event: { channel: "C123", ts: "1.0" },
    }),
  ).toEqual({ eventId: "evt-1", channelId: "C123", threadTs: "1.0" });
});

test("slash の trigger_id と channel_id を読む", () => {
  expect(parseJob({ trigger_id: "trig-1", channel_id: "C123", thread_ts: "1.0" })).toEqual({
    eventId: "trig-1",
    channelId: "C123",
    threadTs: "1.0",
  });
});

test("event より envelope を優先する", () => {
  expect(
    parseJob({
      eventId: "outer",
      channelId: "COUTER",
      threadTs: "9.0",
      event: { channel: "CINNER", ts: "1.0" },
    }),
  ).toEqual({ eventId: "outer", channelId: "COUTER", threadTs: "9.0" });
});

test("null は invalid_job", () => {
  expect(() => parseJob(null)).toThrow(JobParseError);
});

test("配列は invalid_job", () => {
  expect(() => parseJob([])).toThrow(JobParseError);
});

test("文字列は invalid_job", () => {
  expect(() => parseJob("evt")).toThrow(JobParseError);
});

test("eventId が空なら invalid_job", () => {
  expect(() => parseJob({ eventId: "", channelId: "C123", threadTs: "1.0" })).toThrow(
    JobParseError,
  );
});

test("channelId が無いなら invalid_job", () => {
  expect(() => parseJob({ eventId: "evt-1", threadTs: "1.0" })).toThrow(JobParseError);
});

test("threadTs が無いなら invalid_job", () => {
  expect(() => parseJob({ eventId: "evt-1", channelId: "C123" })).toThrow(JobParseError);
});

test("空オブジェクトは invalid_job", () => {
  expect(() => parseJob({})).toThrow(JobParseError);
});
