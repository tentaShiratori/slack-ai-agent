import { expect, test, vi } from "vitest";
import { receiveSlack } from "./receive-slack.ts";

const formType = "application/x-www-form-urlencoded";

function slash(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

test("/refactor と /nfr も指示文付きで enqueue する", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  await receiveSlack(
    slash({
      command: "/refactor",
      text: "extract parser",
      trigger_id: "trig-r",
      channel_id: "C1",
    }),
    enqueue,
    formType,
  );
  expect(JSON.parse(enqueue.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
    command: "/refactor",
    text: "extract parser",
  });

  enqueue.mockClear();
  await receiveSlack(
    slash({ command: "/nfr", text: "p99 under 200ms", trigger_id: "trig-n", channel_id: "C1" }),
    enqueue,
    formType,
  );
  expect(JSON.parse(enqueue.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
    command: "/nfr",
    text: "p99 under 200ms",
  });
});

test("指示文が空の報告 slash は enqueue せず ephemeral を返す", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const empty = await receiveSlack(
    slash({ command: "/feature", text: "", trigger_id: "trig-1", channel_id: "C1" }),
    enqueue,
    formType,
  );
  expect(empty).toEqual({
    status: 200,
    body: { response_type: "ephemeral", text: "指示文を付けてください" },
  });
  expect(enqueue).not.toHaveBeenCalled();

  const missing = await receiveSlack(
    slash({ command: "/refactor", trigger_id: "trig-2", channel_id: "C1" }),
    enqueue,
    formType,
  );
  expect(missing.body).toMatchObject({ response_type: "ephemeral" });
  expect(enqueue).not.toHaveBeenCalled();
});

test("空白だけの指示文も ephemeral", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  const result = await receiveSlack(
    slash({ command: "/nfr", text: "   ", trigger_id: "trig-3", channel_id: "C1" }),
    enqueue,
    formType,
  );
  expect(result.body).toMatchObject({ text: "指示文を付けてください" });
  expect(enqueue).not.toHaveBeenCalled();
});

test("他の slash は空 text でも enqueue する", async () => {
  const enqueue = vi.fn<(rawBody: string) => Promise<void>>(async () => undefined);
  await receiveSlack(
    slash({ command: "/grill", trigger_id: "trig-g", channel_id: "C1" }),
    enqueue,
    formType,
  );
  expect(enqueue).toHaveBeenCalledTimes(1);
});
