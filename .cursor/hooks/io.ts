import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

export function consumeStdin(): void {
  readStdin();
}

export function parseStdinJson<T = Record<string, unknown>>(raw: string): T {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export function readStdinJson<T = Record<string, unknown>>(): T {
  return parseStdinJson<T>(readStdin());
}

export function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
