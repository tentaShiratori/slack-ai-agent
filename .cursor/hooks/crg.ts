import { spawnSync } from "node:child_process";
import { repoRoot } from "./io.ts";

export { consumeStdin, repoRoot, writeJson } from "./io.ts";

export function runCrg(args: string[]): string {
  const root = repoRoot();
  const result = spawnSync("uv", ["run", "code-review-graph", ...args, "--repo", root], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    windowsHide: true,
  });
  if (result.error) return "";
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.replaceAll("\r\n", "\n").trim();
}
