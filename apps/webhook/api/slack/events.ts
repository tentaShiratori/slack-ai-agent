import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withSlackApi } from "../../src/internal/lib/slack/with-slack-api.js";
import { enqueueJob } from "../../src/internal/usecase/enqueue-job.js";
import { handleSlackEvent } from "../../src/internal/lib/slack/handle-slack-event.js";

function rawBodyOf(req: VercelRequest): string {
  if (typeof req.body === "string") {
    return req.body;
  }
  return JSON.stringify(req.body ?? {});
}

export default withSlackApi(async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await handleSlackEvent(rawBodyOf(req), enqueueJob);
  res.status(result.status).json(result.body);
});
