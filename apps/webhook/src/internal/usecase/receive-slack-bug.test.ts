import { expect, test, vi } from "vitest";
import type { OpenBugModal } from "../infra/slack/open-bug-modal.ts";
import { receiveSlack } from "./receive-slack.ts";

const formType = "application/x-www-form-urlencoded";
const bugSlash = new URLSearchParams({
  command: "/bug",
  trigger_id: "trig-1",
  channel_id: "C123",
}).toString();
const modalError = {
  response_type: "ephemeral",
  text: "モーダルを開けませんでした",
};

test("/bug はモーダルを開いて enqueue しない", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const openBugModal = vi.fn<OpenBugModal>(async () => undefined);
  const result = await receiveSlack(bugSlash, enqueue, formType, { openBugModal });
  expect(result).toEqual({ status: 200, body: { ok: true } });
  expect(enqueue).not.toHaveBeenCalled();
  expect(openBugModal).toHaveBeenCalledWith({
    triggerId: "trig-1",
    channelId: "C123",
    threadTs: undefined,
  });
});

test("/bug は thread_ts があれば渡す", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const openBugModal = vi.fn<OpenBugModal>(async () => undefined);
  const raw = new URLSearchParams({
    command: "/bug",
    trigger_id: "trig-2",
    channel_id: "C9",
    thread_ts: "9.0",
  }).toString();
  await receiveSlack(raw, enqueue, formType, { openBugModal });
  expect(openBugModal).toHaveBeenCalledWith({
    triggerId: "trig-2",
    channelId: "C9",
    threadTs: "9.0",
  });
});

test("/bug で opener が無いときは短いエラー", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const result = await receiveSlack(bugSlash, enqueue, formType);
  expect(result).toEqual({ status: 200, body: modalError });
  expect(enqueue).not.toHaveBeenCalled();
});

test("/bug で trigger_id が無いときは短いエラー", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const openBugModal = vi.fn<OpenBugModal>(async () => undefined);
  const raw = new URLSearchParams({ command: "/bug", channel_id: "C123" }).toString();
  const result = await receiveSlack(raw, enqueue, formType, { openBugModal });
  expect(result).toEqual({ status: 200, body: modalError });
  expect(openBugModal).not.toHaveBeenCalled();
});

test("/bug で channel_id が無いときは短いエラー", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const openBugModal = vi.fn<OpenBugModal>(async () => undefined);
  const raw = new URLSearchParams({ command: "/bug", trigger_id: "trig-1" }).toString();
  const result = await receiveSlack(raw, enqueue, formType, { openBugModal });
  expect(result).toEqual({ status: 200, body: modalError });
  expect(openBugModal).not.toHaveBeenCalled();
});

test("/bug でモーダル失敗は短いエラー", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const openBugModal = vi.fn<OpenBugModal>(async () => {
    throw new Error("expired_trigger_id");
  });
  const result = await receiveSlack(bugSlash, enqueue, formType, { openBugModal });
  expect(result).toEqual({ status: 200, body: modalError });
  expect(enqueue).not.toHaveBeenCalled();
});
