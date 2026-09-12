import { VercelApiHandler, VercelRequest, VercelResponse } from "@vercel/node";
import { isDevelopment } from "../constant.js";
import { errorFields, log } from "../logger.js";
import { captureException, flushSentry, initSentry } from "../sentry.js";
import { verifySlackRequest } from "../slack.js";

process.env.SERVICE_NAME ??= "webhook";
initSentry();

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
    try {
      await fn(req, res);
    } catch (error) {
      captureException(error);
      log("ERROR", "slack api handler failed", errorFields(error));
      await flushSentry();
      if (!res.headersSent) {
        res.status(500).json({ error: "internal" });
      }
    }
  };
}
