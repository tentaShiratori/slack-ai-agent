import pkg from "@slack/bolt";
import { env } from "../../lib/constant/env.js";

const { App } = pkg;

export const slack = new App({
  token: env.SLACK_BOT_TOKEN,
  signingSecret: env.SLACK_SIGNING_SECRET,
});
