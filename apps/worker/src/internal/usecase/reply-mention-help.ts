import type { Job } from "../parse-job.ts";

const slashHelpText = [
  "使えるコマンド:",
  "• `/bug` — モーダルから不具合を Issue にし、Project に載せます",
  "• `/feature` `/refactor` `/nfr` — 指示文から Issue にし、Project に載せます",
  "• `/grill` — スレッドで grilling し、要約を Discussion に残します",
  "",
  "メンションだけでは対話しません。slash コマンドを使ってください。",
].join("\n");

export type SlackPoster = {
  postMessage: (args: { channelId: string; threadTs: string; text: string }) => Promise<void>;
};

function shouldReplyMentionHelp(job: Job): boolean {
  if (job.eventType !== "app_mention") {
    return false;
  }
  if (job.botId || job.subtype === "bot_message") {
    return false;
  }
  return true;
}

export async function replyMentionHelp(job: Job, slack: SlackPoster): Promise<void> {
  if (!shouldReplyMentionHelp(job)) {
    return;
  }
  await slack.postMessage({
    channelId: job.channelId,
    threadTs: job.threadTs,
    text: slashHelpText,
  });
}
