import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withSlackApi } from "../lib/api/withSlackApi.js";
import { slack } from "../lib/slack.js";

export default withSlackApi(async function handler(_: VercelRequest, res: VercelResponse) {
  await slack.client.chat.postMessage({
    channel: "C060MDTT9QX",
    text: "test message",
  });
  res.json("success");
  return;
});
