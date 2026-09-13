import { expect, test, vi } from "vitest";
import { receiveSlack } from "./receive-slack.ts";

const formType = "application/x-www-form-urlencoded";

test("content-type が空でも JSON を読む", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const result = await receiveSlack(
    JSON.stringify({ type: "url_verification", challenge: "c" }),
    enqueue,
  );
  expect(result).toEqual({ status: 200, body: { challenge: "c" } });
  expect(enqueue).not.toHaveBeenCalled();
});

test("slash の form を object にする", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  await receiveSlack(
    "command=%2Ffeature&text=add+login&channel_id=C1&trigger_id=t1",
    enqueue,
    formType,
  );
  expect(JSON.parse(enqueue.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
    command: "/feature",
    text: "add login",
    channel_id: "C1",
    event_id: "t1",
  });
});

test("空の payload は 400", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const result = await receiveSlack("payload=", enqueue, formType);
  expect(result).toEqual({ status: 400, body: { error: "invalid_json" } });
  expect(enqueue).not.toHaveBeenCalled();
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
    formType,
  );
  expect(JSON.parse(enqueue.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
    channel_id: "C123",
    thread_ts: "trig-3",
  });
});
