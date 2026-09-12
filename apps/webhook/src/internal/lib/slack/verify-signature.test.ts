import { createHmac } from "node:crypto";
import { expect, test } from "vitest";
import { verifySlackSignature } from "./verify-signature.ts";

const secret = "signing-secret";
const body = '{"type":"event_callback"}';
const nowMs = 1_700_000_000_000;
const timestamp = String(Math.floor(nowMs / 1000));

function sign(ts: string, rawBody: string, version = "v0"): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${version}:${ts}:${rawBody}`);
  return `${version}=${hmac.digest("hex")}`;
}

test("正しい署名は通る", () => {
  expect(
    verifySlackSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp,
      signature: sign(timestamp, body),
      nowMs,
    }),
  ).toBe(true);
});

test("署名が違うと落とす", () => {
  expect(
    verifySlackSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp,
      signature: sign(timestamp, "{}"),
      nowMs,
    }),
  ).toBe(false);
});

test("ヘッダが無いと落とす", () => {
  expect(
    verifySlackSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp: undefined,
      signature: sign(timestamp, body),
      nowMs,
    }),
  ).toBe(false);
  expect(
    verifySlackSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp,
      signature: undefined,
      nowMs,
    }),
  ).toBe(false);
});

test("secret が空なら落とす", () => {
  expect(
    verifySlackSignature({
      signingSecret: "",
      rawBody: body,
      timestamp,
      signature: sign(timestamp, body),
      nowMs,
    }),
  ).toBe(false);
});

test("5 分を超える古い timestamp は落とす", () => {
  const stale = String(Math.floor(nowMs / 1000) - 60 * 5 - 1);
  expect(
    verifySlackSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp: stale,
      signature: sign(stale, body),
      nowMs,
    }),
  ).toBe(false);
});

test("5 分ちょうどの timestamp は通る", () => {
  const edge = String(Math.floor(nowMs / 1000) - 60 * 5);
  expect(
    verifySlackSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp: edge,
      signature: sign(edge, body),
      nowMs,
    }),
  ).toBe(true);
});

test("5 分を超える未来の timestamp は落とす", () => {
  const future = String(Math.floor(nowMs / 1000) + 60 * 5 + 1);
  expect(
    verifySlackSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp: future,
      signature: sign(future, body),
      nowMs,
    }),
  ).toBe(false);
});

test("timestamp が数値でないと落とす", () => {
  expect(
    verifySlackSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp: "not-a-number",
      signature: sign("not-a-number", body),
      nowMs,
    }),
  ).toBe(false);
});

test("未知の署名バージョンは落とす", () => {
  expect(
    verifySlackSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp,
      signature: sign(timestamp, body, "v1"),
      nowMs,
    }),
  ).toBe(false);
});

test("hash が無い署名は落とす", () => {
  expect(
    verifySlackSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp,
      signature: "v0=",
      nowMs,
    }),
  ).toBe(false);
});
