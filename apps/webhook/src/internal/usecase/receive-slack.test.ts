import { expect, test, vi } from "vitest";
import { receiveSlack } from "./receive-slack.ts";

const formType = "application/x-www-form-urlencoded";
const jsonType = "application/json";

test("url_verification は enqueue せず challenge を返す", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const result = await receiveSlack(
    JSON.stringify({ type: "url_verification", challenge: "abc" }),
    enqueue,
    jsonType,
  );
  expect(result).toEqual({ status: 200, body: { challenge: "abc" } });
  expect(enqueue).not.toHaveBeenCalled();
});

test("不正な JSON は 400", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const result = await receiveSlack("{", enqueue, jsonType);
  expect(result).toEqual({ status: 400, body: { error: "invalid_json" } });
  expect(enqueue).not.toHaveBeenCalled();
});

test("不正な interactivity payload は 400", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const result = await receiveSlack("payload=%7B", enqueue, formType);
  expect(result).toEqual({ status: 400, body: { error: "invalid_json" } });
  expect(enqueue).not.toHaveBeenCalled();
});

test("app_mention は enqueue を待ってから ack する", async () => {
  const order: string[] = [];
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async (rawBody) => {
    order.push("enqueue-start");
    expect(rawBody).toContain("evt-1");
    await gate;
    order.push("enqueue-done");
  });
  const pending = receiveSlack(
    JSON.stringify({
      type: "event_callback",
      event_id: "evt-1",
      event: { type: "app_mention", channel: "C1", ts: "1.0", text: "<@Ubot> hi" },
    }),
    enqueue,
    jsonType,
  );
  await vi.waitFor(() => {
    expect(order).toEqual(["enqueue-start"]);
  });
  release?.();
  await expect(pending).resolves.toEqual({ status: 200, body: { ok: true } });
  expect(order).toEqual(["enqueue-start", "enqueue-done"]);
});

test("enqueue 失敗は呼び出し元へ投げる", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => {
    throw new Error("tasks down");
  });
  await expect(
    receiveSlack(
      JSON.stringify({
        type: "event_callback",
        event_id: "evt-1",
        event: { type: "app_mention", channel: "C1", ts: "1.0" },
      }),
      enqueue,
      jsonType,
    ),
  ).rejects.toThrow("tasks down");
});

test("slash command を JSON にして enqueue する", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const raw = new URLSearchParams({
    command: "/feature",
    text: "add login",
    trigger_id: "trig-1",
    channel_id: "C123",
  }).toString();
  const result = await receiveSlack(raw, enqueue, formType);
  expect(result).toEqual({ status: 200, body: { ok: true } });
  expect(JSON.parse(enqueue.mock.calls[0]?.[0] ?? "{}")).toEqual({
    command: "/feature",
    text: "add login",
    trigger_id: "trig-1",
    channel_id: "C123",
    event_id: "trig-1",
    thread_ts: "trig-1",
  });
});

test("view_submission は payload JSON を enqueue する", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const payload = {
    type: "view_submission",
    trigger_id: "trig-2",
    view: { private_metadata: JSON.stringify({ channel_id: "C9", thread_ts: "9.0" }) },
  };
  const raw = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
  const result = await receiveSlack(raw, enqueue, `${formType}; charset=utf-8`);
  expect(result.status).toBe(200);
  expect(JSON.parse(enqueue.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
    type: "view_submission",
    event_id: "trig-2",
    channel_id: "C9",
    thread_ts: "9.0",
  });
});

test("thread 返信を enqueue する", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  await receiveSlack(
    JSON.stringify({
      type: "event_callback",
      event_id: "evt-2",
      event: { type: "message", channel: "C1", ts: "2.0", thread_ts: "1.0", text: "reply" },
    }),
    enqueue,
    jsonType,
  );
  expect(enqueue).toHaveBeenCalledTimes(1);
});

test("スレッドでない message は enqueue しない", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const result = await receiveSlack(
    JSON.stringify({
      type: "event_callback",
      event_id: "evt-3",
      event: { type: "message", channel: "C1", ts: "1.0", text: "hi" },
    }),
    enqueue,
    jsonType,
  );
  expect(result).toEqual({ status: 200, body: { ok: true } });
  expect(enqueue).not.toHaveBeenCalled();
});

test("bot の app_mention は enqueue しない", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  await receiveSlack(
    JSON.stringify({
      type: "event_callback",
      event_id: "evt-4",
      event: { type: "app_mention", channel: "C1", ts: "1.0", bot_id: "B1" },
    }),
    enqueue,
    jsonType,
  );
  expect(enqueue).not.toHaveBeenCalled();
});

test("未知の event は ack のみ", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  await receiveSlack(
    JSON.stringify({
      type: "event_callback",
      event_id: "evt-5",
      event: { type: "reaction_added", channel: "C1" },
    }),
    enqueue,
    jsonType,
  );
  expect(enqueue).not.toHaveBeenCalled();
});

test("message_changed は enqueue しない", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  await receiveSlack(
    JSON.stringify({
      type: "event_callback",
      event_id: "evt-6",
      event: { type: "message", subtype: "message_changed", channel: "C1", thread_ts: "1.0" },
    }),
    enqueue,
    jsonType,
  );
  expect(enqueue).not.toHaveBeenCalled();
});

test("bot_message は enqueue しない", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  await receiveSlack(
    JSON.stringify({
      type: "event_callback",
      event_id: "evt-7",
      event: { type: "message", subtype: "bot_message", channel: "C1", thread_ts: "1.0" },
    }),
    enqueue,
    jsonType,
  );
  expect(enqueue).not.toHaveBeenCalled();
});
