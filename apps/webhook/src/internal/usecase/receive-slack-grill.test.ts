import { expect, test, vi } from "vitest";
import { receiveSlack } from "./receive-slack.ts";

const formType = "application/x-www-form-urlencoded";
const jsonType = "application/json";

function slash(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

test("/grill はテーマ付きで enqueue する", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const result = await receiveSlack(
    slash({
      command: "/grill",
      text: "ログイン設計",
      trigger_id: "trig-g",
      channel_id: "C123",
    }),
    enqueue,
    formType,
  );
  expect(result).toEqual({ status: 200, body: { ok: true } });
  expect(JSON.parse(enqueue.mock.calls[0]?.[0] ?? "{}")).toEqual({
    command: "/grill",
    text: "ログイン設計",
    trigger_id: "trig-g",
    channel_id: "C123",
    event_id: "trig-g",
    thread_ts: "trig-g",
  });
});

test("スレッドの /grill は thread_ts を残す", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  await receiveSlack(
    slash({
      command: "/grill",
      text: "theme",
      trigger_id: "trig-g",
      channel_id: "C123",
      thread_ts: "1.0",
    }),
    enqueue,
    formType,
  );
  expect(JSON.parse(enqueue.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
    command: "/grill",
    thread_ts: "1.0",
    event_id: "trig-g",
  });
});

test("grilling スレッドの返信は enqueue する", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  await receiveSlack(
    JSON.stringify({
      type: "event_callback",
      event_id: "evt-2",
      event: { type: "message", channel: "C123", ts: "2.0", thread_ts: "1.0", text: "A1" },
    }),
    enqueue,
    jsonType,
  );
  expect(enqueue).toHaveBeenCalledTimes(1);
});
