import type { SlackClient } from "../slack.ts";

class SlackApiError extends Error {
  readonly slackError: string;

  constructor(slackError: string) {
    super(`Slack API: ${slackError}`);
    this.name = "SlackApiError";
    this.slackError = slackError;
  }
}

const slackApiRoot = "https://slack.com/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function slackPost(
  fetchFn: typeof fetch,
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await fetchFn(`${slackApiRoot}/${method}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new SlackApiError(`invalid_json:${response.status}`);
  }
  if (!isRecord(payload) || payload.ok !== true) {
    const error =
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `http_${response.status}`;
    throw new SlackApiError(error);
  }
}

export function createSlackClient(token: string, fetchFn: typeof fetch = fetch): SlackClient {
  return {
    async postMessage(input) {
      await slackPost(fetchFn, token, "chat.postMessage", {
        channel: input.channelId,
        text: input.text,
        ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
      });
    },
  };
}
