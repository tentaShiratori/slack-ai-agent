import { VercelApiHandler, VercelRequest, VercelResponse } from "@vercel/node";
import { isDevelopment } from "../constant.js";
import { verifySlackRequest } from "../slack.js";

function isVerifySlackRequest(req: VercelRequest) {
  try {
    verifySlackRequest(req);
    return true;
  } catch {
    return false;
  }
}
/**
 * slackからのrequestか検証する
 * ```
 * @param fn
 * @returns
 */
export function withSlackApi(fn: VercelApiHandler) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (!isDevelopment && !isVerifySlackRequest(req)) {
      res.status(403).json("Forbidden");
      return;
    }
    await fn(req, res);
    return;
  };
}
