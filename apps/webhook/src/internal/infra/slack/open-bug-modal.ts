export type OpenBugModalInput = {
  triggerId: string;
  channelId: string;
  threadTs?: string;
};

export type OpenBugModal = (input: OpenBugModalInput) => Promise<void>;

class SlackApiError extends Error {
  readonly slackError: string;

  constructor(slackError: string) {
    super(`Slack API: ${slackError}`);
    this.name = "SlackApiError";
    this.slackError = slackError;
  }
}

const bugReportCallbackId = "bug_report";

function plainText(text: string) {
  return { type: "plain_text" as const, text };
}

function inputBlock(blockId: string, label: string, multiline = false) {
  return {
    type: "input" as const,
    block_id: blockId,
    label: plainText(label),
    element: {
      type: "plain_text_input" as const,
      action_id: "value",
      multiline,
    },
  };
}

function bugModalView(input: OpenBugModalInput) {
  return {
    type: "modal" as const,
    callback_id: bugReportCallbackId,
    title: plainText("不具合の報告"),
    submit: plainText("送信"),
    close: plainText("キャンセル"),
    private_metadata: JSON.stringify({
      channel_id: input.channelId,
      ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
    }),
    blocks: [
      inputBlock("title", "タイトル"),
      inputBlock("reproduction", "再現", true),
      inputBlock("expected", "期待", true),
      inputBlock("actual", "実際", true),
    ],
  };
}

async function viewsOpen(
  token: string,
  input: OpenBugModalInput,
  fetchFn: typeof fetch,
): Promise<void> {
  const response = await fetchFn("https://slack.com/api/views.open", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      trigger_id: input.triggerId,
      view: bugModalView(input),
    }),
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new SlackApiError(`invalid_json:${response.status}`);
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("ok" in payload) ||
    payload.ok !== true
  ) {
    const error =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `http_${response.status}`;
    throw new SlackApiError(error);
  }
}

export function createOpenBugModal(token: string, fetchFn: typeof fetch = fetch): OpenBugModal {
  return (input) => viewsOpen(token, input, fetchFn);
}
