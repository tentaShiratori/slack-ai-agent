import { VercelApiHandler, VercelRequest, VercelResponse } from "@vercel/node";
import { env } from "../constant/env.js";
import { isDevelopment } from "../constant/constant.ts";
import { errorFields, log } from "../metrics/logger.ts";
import { captureException, flushSentry, initSentry } from "../metrics/sentry.ts";
import { verifySlackRequest } from "./verifyRequest.ts";

process.env.SERVICE_NAME ??= env.SERVICE_NAME ?? "webhook";
initSentry({
  dsn: env.SENTRY_DSN,
  environment: env.SENTRY_ENVIRONMENT ?? env.VERCEL_ENV ?? env.NODE_ENV,
});

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
