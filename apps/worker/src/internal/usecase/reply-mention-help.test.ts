import { expect, test, vi } from "vitest";
import type { Job } from "../parse-job.ts";
import { replyMentionHelp, type SlackPoster } from "./reply-mention-help.ts";

const mention: Job = {
  eventId: "evt-1",
  channelId: "C123",
  threadTs: "1.0",
  eventType: "app_mention",
  text: "<@U123>",
};

function poster() {
  return {
    postMessage: vi.fn<SlackPoster["postMessage"]>(async () => undefined),
  };
}

test("素のメンションは slash ヘルプを投稿する", async () => {
  const slack = poster();
  await replyMentionHelp(mention, slack);
  expect(slack.postMessage).toHaveBeenCalledOnce();
  expect(slack.postMessage.mock.calls[0]?.[0]).toMatchObject({
    channelId: "C123",
    threadTs: "1.0",
  });
});

test("余分な本文があっても Agent せずヘルプだけ投稿する", async () => {
  const slack = poster();
  await replyMentionHelp({ ...mention, text: "<@U123> 今日の天気は？" }, slack);
  expect(slack.postMessage).toHaveBeenCalledOnce();
  const text = slack.postMessage.mock.calls[0]?.[0].text ?? "";
  expect(text).toContain("/bug");
  expect(text).toContain("/feature");
  expect(text).toContain("/refactor");
  expect(text).toContain("/nfr");
  expect(text).toContain("/grill");
  expect(text).toContain("メンションだけでは対話しません");
  expect(text).not.toMatch(/wiki/i);
});

test("app_mention 以外は投稿しない", async () => {
  const slack = poster();
  await replyMentionHelp({ ...mention, eventType: "message" }, slack);
  await replyMentionHelp({ eventId: "e", channelId: "C1", threadTs: "1.0" }, slack);
  expect(slack.postMessage).not.toHaveBeenCalled();
});

test("bot 自身の投稿は返さない", async () => {
  const slack = poster();
  await replyMentionHelp({ ...mention, botId: "B1" }, slack);
  await replyMentionHelp({ ...mention, subtype: "bot_message" }, slack);
  expect(slack.postMessage).not.toHaveBeenCalled();
});

test("投稿失敗は呼び出し元へ投げる", async () => {
  const slack = {
    postMessage: vi.fn<SlackPoster["postMessage"]>(async () => {
      throw new Error("channel_not_found");
    }),
  };
  await expect(replyMentionHelp(mention, slack)).rejects.toThrow("channel_not_found");
});
