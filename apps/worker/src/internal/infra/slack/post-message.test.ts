import { expect, test, vi } from "vitest";
import { createSlackPoster } from "./post-message.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("chat.postMessage に channel と thread_ts を送る", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
  const slack = createSlackPoster("xoxb-dev", fetchFn);
  await slack.postMessage({ channelId: "C123", threadTs: "1.0", text: "help" });
  expect(fetchFn).toHaveBeenCalledOnce();
  expect(fetchFn).toHaveBeenCalledWith("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      authorization: "Bearer xoxb-dev",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: "C123",
      thread_ts: "1.0",
      text: "help",
    }),
  });
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
