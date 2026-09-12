import { expect, test, vi } from "vitest";
import { createSlackClient } from "./slack-client.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("チャンネルに投稿する", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
  await createSlackClient("xoxb-test", fetchFn).postMessage({
    channelId: "C123",
    text: "hello",
  });
  expect(fetchFn.mock.calls[0]?.[0]).toBe("https://slack.com/api/chat.postMessage");
  const init = fetchFn.mock.calls[0]?.[1];
  expect(init?.method).toBe("POST");
  expect(init?.headers).toEqual({
    authorization: "Bearer xoxb-test",
    "content-type": "application/json; charset=utf-8",
  });
  if (typeof init?.body !== "string") {
    throw new Error("expected string body");
  }
  expect(JSON.parse(init.body)).toEqual({ channel: "C123", text: "hello" });
});

test("thread_ts があればスレッドに投稿する", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
  await createSlackClient("xoxb-test", fetchFn).postMessage({
    channelId: "C123",
    threadTs: "9.0",
    text: "hello",
  });
  const init = fetchFn.mock.calls[0]?.[1];
  if (typeof init?.body !== "string") {
    throw new Error("expected string body");
  }
  expect(JSON.parse(init.body)).toEqual({
    channel: "C123",
    text: "hello",
    thread_ts: "9.0",
  });
});

test("ok:false は SlackApiError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () =>
    jsonResponse({ ok: false, error: "channel_not_found" }),
  );
  await expect(
    createSlackClient("xoxb-test", fetchFn).postMessage({ channelId: "C123", text: "hi" }),
  ).rejects.toMatchObject({ name: "SlackApiError", slackError: "channel_not_found" });
});

test("JSON でない応答は SlackApiError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("nope", { status: 500 }));
  const error = await createSlackClient("xoxb-test", fetchFn)
    .postMessage({ channelId: "C1", text: "hi" })
    .catch((e: unknown) => e);
  expect(error).toMatchObject({ name: "SlackApiError", slackError: "invalid_json:500" });
});

test("ok でないオブジェクトは http ステータスを付ける", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: false }, 503));
  await expect(
    createSlackClient("xoxb-test", fetchFn).postMessage({ channelId: "C1", text: "hi" }),
  ).rejects.toMatchObject({ slackError: "http_503" });
});
