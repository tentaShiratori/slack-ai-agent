import { createHmac } from "crypto";
import { VercelRequest } from "@vercel/node";
import tsscmp from "tsscmp";
import { env } from "../../lib/constant/env.js";

// ------------------------------
// HTTP module independent methods
// ------------------------------

const verifyErrorPrefix = "Failed to verify authenticity";

/**
 * Verifies the signature of an incoming request from Slack.
 * If the request is invalid, this method throws an exception with the error details.
 */
export function verifySlackRequest(req: VercelRequest): void {
  const requestTimestampSecHeader = req.headers["x-slack-request-timestamp"];
  const signature = req.headers["x-slack-signature"];
  if (Number.isNaN(requestTimestampSecHeader)) {
    throw new Error(
      `${verifyErrorPrefix}: header x-slack-request-timestamp did not have the expected type (${requestTimestampSecHeader?.toString() ?? "undefined"})`,
    );
  }
  if (signature == null || Array.isArray(signature)) {
    throw new Error(
      `${verifyErrorPrefix}: header x-slack-signature did not have the expected type (${signature?.toString() ?? "undefined"})`,
    );
  }

  const requestTimestampSec = Number(requestTimestampSecHeader);

  // Calculate time-dependent values
  const nowMs = Date.now();
  const requestTimestampMaxDeltaMin = 5;
  const fiveMinutesAgoSec = Math.floor(nowMs / 1000) - 60 * requestTimestampMaxDeltaMin;

  // Enforce verification rules

  // Rule 1: Check staleness
  if (requestTimestampSec < fiveMinutesAgoSec) {
    throw new Error(
      `${verifyErrorPrefix}: x-slack-request-timestamp must differ from system time by no more than ${requestTimestampMaxDeltaMin} minutes or request is stale`,
    );
  }

  // Rule 2: Check signature
  // Separate parts of signature
  const [signatureVersion, signatureHash] = signature.split("=");
  // Only handle known versions
  if (signatureVersion !== "v0") {
    throw new Error(`${verifyErrorPrefix}: unknown signature version`);
  }
  // Compute our own signature hash
  const hmac = createHmac("sha256", env.SLACK_SIGNING_SECRET ?? "");

  // We should detect the body have "toString" because the body parsed by vercel is mede by Object.create(null) or regular object.
  // the original shape of the body have "toString" is JSON.
  // the original shape of the body not have "toString" is URLSearchParams.
  // We should add the escape of slash because vercel remove the escape of slash when the body is JSON.
  const body =
    "toString" in req.body
      ? JSON.stringify(req.body).replaceAll("/", "\\/")
      : new URLSearchParams(req.body as Record<string, string>).toString();

  hmac.update(`${signatureVersion}:${requestTimestampSec}:${body}`);
  const ourSignatureHash = hmac.digest("hex");
  if (!signatureHash || !tsscmp(signatureHash, ourSignatureHash)) {
    throw new Error(`${verifyErrorPrefix}: signature mismatch`);
  }
}
