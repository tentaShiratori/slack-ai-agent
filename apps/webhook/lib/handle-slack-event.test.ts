import { expect, test, vi } from "vitest";
import { handleSlackEvent } from "./handle-slack-event.ts";

test("url_verification は enqueue せず challenge を返す", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const result = await handleSlackEvent(JSON.stringify({ type: "url_verification", challenge: "abc" }), enqueue);
  expect(result).toEqual({ status: 200, body: { challenge: "abc" } });
  expect(enqueue).not.toHaveBeenCalled();
});

test("不正な JSON は 400", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const result = await handleSlackEvent("{", enqueue);
  expect(result).toEqual({ status: 400, body: { error: "invalid_json" } });
  expect(enqueue).not.toHaveBeenCalled();
});

test("イベントは enqueue を待ってから ack する", async () => {
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
  const pending = handleSlackEvent(
    JSON.stringify({ type: "event_callback", event_id: "evt-1", event: { channel: "C1", ts: "1.0" } }),
    enqueue,
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
  await expect(handleSlackEvent(JSON.stringify({ type: "event_callback" }), enqueue)).rejects.toThrow("tasks down");
});
