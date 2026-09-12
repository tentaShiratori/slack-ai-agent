import { createHmac, timingSafeEqual } from "node:crypto";

const maxAgeSec = 60 * 5;

export function verifySlackSignature(opts: {
  signingSecret: string;
  rawBody: string;
  timestamp: string | undefined;
  signature: string | undefined;
  nowMs?: number;
}): boolean {
  const { signingSecret, rawBody, timestamp, signature } = opts;
  if (!signingSecret || typeof timestamp !== "string" || typeof signature !== "string") {
    return false;
  }
  const ts = Number(timestamp);
  const nowSec = (opts.nowMs ?? Date.now()) / 1000;
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > maxAgeSec) {
    return false;
  }
  const [version, hash] = signature.split("=");
  if (version !== "v0" || !hash) {
    return false;
  }
  const hmac = createHmac("sha256", signingSecret);
  hmac.update(`${version}:${timestamp}:${rawBody}`);
  const digest = hmac.digest("hex");
  const a = Buffer.from(hash, "utf8");
  const b = Buffer.from(digest, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
