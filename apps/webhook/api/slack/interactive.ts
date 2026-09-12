import type { VercelRequest, VercelResponse } from "@vercel/node";
import { slackVercelHandler } from "../../src/internal/controller/vercel-slack.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await slackVercelHandler(req, res);
}
