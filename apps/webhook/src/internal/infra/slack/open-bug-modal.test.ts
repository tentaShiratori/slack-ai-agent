import { expect, test, vi } from "vitest";
import { createOpenBugModal } from "./open-bug-modal.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestBody(init: RequestInit | undefined): {
  trigger_id: string;
  view: {
    callback_id: string;
    private_metadata: string;
    blocks: Array<{ block_id: string }>;
  };
} {
  if (typeof init?.body !== "string") {
    throw new Error("expected string body");
  }
  return JSON.parse(init.body) as {
    trigger_id: string;
    view: {
      callback_id: string;
      private_metadata: string;
      blocks: Array<{ block_id: string }>;
    };
  };
}

test("モーダルにタイトル・再現・期待・実際がある", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
  await createOpenBugModal(
    "xoxb-test",
    fetchFn,
  )({
    triggerId: "t1",
    channelId: "C1",
    threadTs: "9.0",
  });
  const body = requestBody(fetchFn.mock.calls[0]?.[1]);
  expect(body.view.callback_id).toBe("bug_report");
  expect(body.view.private_metadata).toBe(JSON.stringify({ channel_id: "C1", thread_ts: "9.0" }));
  expect(body.view.blocks.map((block) => block.block_id)).toEqual([
    "title",
    "reproduction",
    "expected",
    "actual",
  ]);
});

test("thread_ts が無ければ metadata に入れない", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
  await createOpenBugModal("xoxb-test", fetchFn)({ triggerId: "t1", channelId: "C1" });
  expect(JSON.parse(requestBody(fetchFn.mock.calls[0]?.[1]).view.private_metadata)).toEqual({
    channel_id: "C1",
  });
});

test("views.open に trigger_id と view を送る", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
  await createOpenBugModal("xoxb-test", fetchFn)({ triggerId: "trig-1", channelId: "C9" });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(fetchFn.mock.calls[0]?.[0]).toBe("https://slack.com/api/views.open");
  const init = fetchFn.mock.calls[0]?.[1];
  expect(init?.method).toBe("POST");
  expect(init?.headers).toEqual({
    authorization: "Bearer xoxb-test",
    "content-type": "application/json; charset=utf-8",
  });
  const body = requestBody(init);
  expect(body.trigger_id).toBe("trig-1");
  expect(body.view.callback_id).toBe("bug_report");
});

test("ok:false は SlackApiError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () =>
    jsonResponse({ ok: false, error: "expired_trigger_id" }),
  );
  const error = await createOpenBugModal(
    "xoxb-test",
    fetchFn,
  )({
    triggerId: "trig-1",
    channelId: "C1",
  }).catch((e: unknown) => e);
  expect(error).toMatchObject({ name: "SlackApiError", slackError: "expired_trigger_id" });
});

test("JSON でない応答は SlackApiError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("nope", { status: 502 }));
  await expect(
    createOpenBugModal("xoxb-test", fetchFn)({ triggerId: "trig-1", channelId: "C1" }),
  ).rejects.toMatchObject({ name: "SlackApiError", slackError: "invalid_json:502" });
});

test("error フィールドが無い失敗は http ステータス", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: false }, 200));
  await expect(
    createOpenBugModal("xoxb-test", fetchFn)({ triggerId: "trig-1", channelId: "C1" }),
  ).rejects.toMatchObject({ slackError: "http_200" });
});
