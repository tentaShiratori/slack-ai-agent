export async function handleSlackEvent(
  rawBody: string,
  enqueue: (rawBody: string) => Promise<void>,
): Promise<{ status: number; body: unknown }> {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "type" in payload &&
    payload.type === "url_verification"
  ) {
    const challenge = "challenge" in payload ? payload.challenge : undefined;
    return { status: 200, body: { challenge } };
  }

  await enqueue(rawBody);
  return { status: 200, body: { ok: true } };
}
