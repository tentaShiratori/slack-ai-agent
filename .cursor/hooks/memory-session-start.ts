import { readFileSync } from "node:fs";
import { join } from "node:path";
import { consumeStdin, repoRoot, writeJson } from "./io.ts";

consumeStdin();

try {
  const text = readFileSync(join(repoRoot(), "progress.md"), "utf8");
  writeJson({ additional_context: text });
} catch {
  writeJson({ additional_context: "progress.md が見つかりません。" });
}
