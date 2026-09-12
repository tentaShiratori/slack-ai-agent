import { expect, test, vi } from "vitest";
import { parseSlackBody, receiveSlack } from "./receive-slack.ts";

test("JSON を読む", () => {
  expect(parseSlackBody('{"type":"event_callback"}', "application/json")).toEqual({
    type: "event_callback",
  });
});

test("content-type が空でも JSON を読む", () => {
  expect(parseSlackBody('{"ok":true}')).toEqual({ ok: true });
});

test("不正な JSON は投げる", () => {
  expect(() => parseSlackBody("{", "application/json")).toThrow(SyntaxError);
});

test("slash の form を object にする", () => {
  expect(
    parseSlackBody("command=%2Fbug&channel_id=C1", "application/x-www-form-urlencoded"),
  ).toEqual({ command: "/bug", channel_id: "C1" });
});

test("interactivity の payload JSON を読む", () => {
  const inner = { type: "view_submission", trigger_id: "t1" };
  const raw = new URLSearchParams({ payload: JSON.stringify(inner) }).toString();
  expect(parseSlackBody(raw, "application/x-www-form-urlencoded; charset=utf-8")).toEqual(inner);
});

test("payload が不正なら投げる", () => {
  expect(() => parseSlackBody("payload=%7B", "application/x-www-form-urlencoded")).toThrow(
    SyntaxError,
  );
});

test("空の payload は投げる", () => {
  expect(() => parseSlackBody("payload=", "application/x-www-form-urlencoded")).toThrow(
    SyntaxError,
  );
});

test("private_metadata が文字列なら channel_id にする", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const payload = {
    type: "view_submission",
    trigger_id: "trig-3",
    view: { private_metadata: "C123" },
  };
  await receiveSlack(
    new URLSearchParams({ payload: JSON.stringify(payload) }).toString(),
    enqueue,
    "application/x-www-form-urlencoded",
  );
  expect(JSON.parse(enqueue.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
    channel_id: "C123",
    thread_ts: "trig-3",
  });
});
