import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withSlackApi } from "../../lib/api/withSlackApi.js";
import { enqueueJob } from "../../lib/enqueue-job.js";
import { handleSlackEvent } from "../../lib/handle-slack-event.js";

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
