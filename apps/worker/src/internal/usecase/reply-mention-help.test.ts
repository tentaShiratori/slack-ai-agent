import { expect, test, vi } from "vitest";
import type { Job } from "../parse-job.ts";
import {
  replyMentionHelp,
  shouldReplyMentionHelp,
  slashHelpText,
  type SlackPoster,
} from "./reply-mention-help.ts";

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

test("素の app_mention はヘルプ対象", () => {
  expect(shouldReplyMentionHelp(mention)).toBe(true);
});

test("本文付き app_mention もヘルプ対象（対話しない）", () => {
  expect(shouldReplyMentionHelp({ ...mention, text: "<@U123> wiki を検索して" })).toBe(true);
});

test("app_mention 以外は対象外", () => {
  expect(shouldReplyMentionHelp({ ...mention, eventType: "message" })).toBe(false);
  expect(shouldReplyMentionHelp({ eventId: "e", channelId: "C1", threadTs: "1.0" })).toBe(false);
});

test("bot 自身の投稿は対象外", () => {
  expect(shouldReplyMentionHelp({ ...mention, botId: "B1" })).toBe(false);
  expect(shouldReplyMentionHelp({ ...mention, subtype: "bot_message" })).toBe(false);
});

test("素のメンションは slash ヘルプを投稿する", async () => {
  const slack = poster();
  await replyMentionHelp(mention, slack);
  expect(slack.postMessage).toHaveBeenCalledOnce();
  expect(slack.postMessage).toHaveBeenCalledWith({
    channelId: "C123",
    threadTs: "1.0",
    text: slashHelpText,
  });
});

test("余分な本文があっても Agent せずヘルプだけ投稿する", async () => {
  const slack = poster();
  await replyMentionHelp({ ...mention, text: "<@U123> 今日の天気は？" }, slack);
  expect(slack.postMessage).toHaveBeenCalledOnce();
  expect(slack.postMessage.mock.calls[0]?.[0].text).toBe(slashHelpText);
});

test("対象外なら投稿しない", async () => {
  const slack = poster();
  await replyMentionHelp({ ...mention, eventType: "message" }, slack);
  await replyMentionHelp({ ...mention, botId: "B1" }, slack);
  expect(slack.postMessage).not.toHaveBeenCalled();
});

test("ヘルプ文は slash 一覧で wiki 対話ではない", () => {
  expect(slashHelpText).toContain("/bug");
  expect(slashHelpText).toContain("/feature");
  expect(slashHelpText).toContain("/refactor");
  expect(slashHelpText).toContain("/nfr");
  expect(slashHelpText).toContain("/grill");
  expect(slashHelpText).toContain("メンションだけでは対話しません");
  expect(slashHelpText).not.toMatch(/wiki/i);
});

test("投稿失敗は呼び出し元へ投げる", async () => {
  const slack = {
    postMessage: vi.fn<SlackPoster["postMessage"]>(async () => {
      throw new Error("channel_not_found");
    }),
  };
  await expect(replyMentionHelp(mention, slack)).rejects.toThrow("channel_not_found");
});
