class SlackPostError extends Error {
  constructor(message = "slack_post_failed") {
    super(message);
    this.name = "SlackPostError";
  }
}

const slackPostMessageUrl = "https://slack.com/api/chat.postMessage";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export type SlackPoster = {
  postMessage: (args: {
    channelId: string;
    threadTs?: string;
    text: string;
  }) => Promise<{ ts: string }>;
};

export function createSlackPoster(token: string, fetchFn: typeof fetch = fetch): SlackPoster {
  return {
    async postMessage(args: { channelId: string; threadTs?: string; text: string }) {
      const { channelId, threadTs, text } = args;
      const response = await fetchFn(slackPostMessageUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          channel: channelId,
          text,
          ...(threadTs ? { thread_ts: threadTs } : {}),
        }),
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new SlackPostError("slack_post_invalid_json");
      }

      const record = asRecord(payload);
      if (!response.ok || record?.ok !== true) {
        const error = typeof record?.error === "string" ? record.error : "slack_post_failed";
        throw new SlackPostError(error);
      }
      const ts = typeof record.ts === "string" && record.ts.length > 0 ? record.ts : undefined;
      if (!ts) {
        throw new SlackPostError("slack_post_missing_ts");
      }
      return { ts };
    },
  };
}
