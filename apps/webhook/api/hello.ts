import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withSlackApi } from "../src/internal/lib/slack/with-slack-api.js";
import { slack } from "../src/internal/infra/slack/client.js";

export default withSlackApi(async function handler(_: VercelRequest, res: VercelResponse) {
  await slack.client.chat.postMessage({
    channel: "C060MDTT9QX",
    text: "test message",
  });
  res.json("success");
  return;
});
