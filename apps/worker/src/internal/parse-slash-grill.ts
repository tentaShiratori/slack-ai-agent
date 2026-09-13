export type SlashGrill = {
  theme: string;
};

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function parseSlashGrill(body: Record<string, unknown>): SlashGrill | undefined {
  const command = asNonEmptyString(body.command);
  if (command !== "/grill") {
    return undefined;
  }
  const theme = typeof body.text === "string" ? body.text.trim() : "";
  return { theme };
}
