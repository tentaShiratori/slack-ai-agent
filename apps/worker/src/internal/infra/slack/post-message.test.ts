import { expect, test, vi } from "vitest";
import { createSlackPoster } from "./post-message.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("chat.postMessage に channel と thread_ts を送る", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true, ts: "1.0" }));
  const slack = createSlackPoster("xoxb-dev", fetchFn);
  await expect(
    slack.postMessage({ channelId: "C123", threadTs: "1.0", text: "help" }),
  ).resolves.toEqual({ ts: "1.0" });
  expect(fetchFn).toHaveBeenCalledOnce();
  const init = fetchFn.mock.calls[0]?.[1];
  expect(fetchFn.mock.calls[0]?.[0]).toBe("https://slack.com/api/chat.postMessage");
  expect(init?.method).toBe("POST");
  expect(init?.headers).toEqual({
    authorization: "Bearer xoxb-dev",
    "content-type": "application/json; charset=utf-8",
  });
  if (typeof init?.body !== "string") {
    throw new Error("expected string body");
  }
  expect(JSON.parse(init.body)).toEqual({
    channel: "C123",
    text: "help",
    thread_ts: "1.0",
  });
});

test("thread_ts が無ければチャンネルに投稿する", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true, ts: "9.0" }));
  await expect(
    createSlackPoster("xoxb-dev", fetchFn).postMessage({
      channelId: "C123",
      text: "hello",
    }),
  ).resolves.toEqual({ ts: "9.0" });
  const init = fetchFn.mock.calls[0]?.[1];
  if (typeof init?.body !== "string") {
    throw new Error("expected string body");
  }
  expect(JSON.parse(init.body)).toEqual({ channel: "C123", text: "hello" });
});

test("ok:false は SlackPostError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () =>
    jsonResponse({ ok: false, error: "channel_not_found" }),
  );
  const slack = createSlackPoster("xoxb-dev", fetchFn);
  await expect(
    slack.postMessage({ channelId: "C123", threadTs: "1.0", text: "help" }),
  ).rejects.toMatchObject({ name: "SlackPostError", message: "channel_not_found" });
});

test("HTTP エラーは SlackPostError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }, 500));
  const slack = createSlackPoster("xoxb-dev", fetchFn);
  await expect(
    slack.postMessage({ channelId: "C123", threadTs: "1.0", text: "help" }),
  ).rejects.toMatchObject({ name: "SlackPostError", message: "slack_post_failed" });
});

test("JSON でない応答は SlackPostError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response("nope", { status: 200 }));
  const slack = createSlackPoster("xoxb-dev", fetchFn);
  await expect(
    slack.postMessage({ channelId: "C123", threadTs: "1.0", text: "help" }),
  ).rejects.toThrow("slack_post_invalid_json");
});

test("配列の JSON は SlackPostError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse([]));
  const slack = createSlackPoster("xoxb-dev", fetchFn);
  await expect(
    slack.postMessage({ channelId: "C123", threadTs: "1.0", text: "help" }),
  ).rejects.toMatchObject({ name: "SlackPostError" });
});

test("ts が無い ok 応答は SlackPostError", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
  const slack = createSlackPoster("xoxb-dev", fetchFn);
  await expect(
    slack.postMessage({ channelId: "C123", threadTs: "1.0", text: "help" }),
  ).rejects.toMatchObject({ name: "SlackPostError", message: "slack_post_missing_ts" });
});
