export type GrillTurnResult =
  | { status: "continue"; message: string }
  | { status: "done"; title: string; summary: string };

const grillPrefix = "grill:";

export function grillSessionId(agentId: string): string {
  return `${grillPrefix}${agentId}`;
}

export function parseGrillAgentId(sessionId: string | null | undefined): string | undefined {
  if (!sessionId?.startsWith(grillPrefix)) {
    return undefined;
  }
  const agentId = sessionId.slice(grillPrefix.length);
  return agentId.length > 0 ? agentId : undefined;
}

export function buildGrillStartPrompt(theme: string): string {
  const themeLine = theme
    ? `テーマ: ${theme}`
    : "テーマはまだ示されていません。最初の frontier で確認してください。";
  return [
    "あなたは grilling の進行役です。前提を問いで固め、決定と非目標を短く残します。",
    "ファイルは読まず編集せず、JSON だけを返してください。",
    "各ラウンドでは今聞ける frontier の質問を番号付きで出し、各問に推奨回答を付けます。",
    '継続: {"status":"continue","message":"Slack向けmarkdown"}',
    '終了: {"status":"done","title":"string","summary":"markdown"}',
    "frontier が空、または利用者が終了・合意を示したら done にします。",
    themeLine,
  ].join("\n");
}

export function buildGrillFollowUp(text: string): string {
  return [
    "次の利用者の回答です。frontier を更新し、JSON だけを返してください。",
    text || "(空の返信)",
  ].join("\n");
}

function jsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("grill_failed");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("grill_failed");
  }
  return parsed as Record<string, unknown>;
}

export function parseGrillTurn(raw: string): GrillTurnResult {
  const parsed = jsonObject(raw);
  const status = parsed.status;
  if (status === "continue") {
    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    if (!message) {
      throw new Error("grill_failed");
    }
    return { status: "continue", message };
  }
  if (status === "done") {
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    if (!title || !summary) {
      throw new Error("grill_failed");
    }
    return { status: "done", title, summary };
  }
  throw new Error("grill_failed");
}
