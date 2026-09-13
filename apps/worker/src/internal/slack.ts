export type PostMessageInput = {
  channelId: string;
  threadTs?: string;
  text: string;
};

export type SlackClient = {
  postMessage(input: PostMessageInput): Promise<void>;
};
