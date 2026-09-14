import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { hookEnv } from "./hook_env.ts";
import { readStdinJson, repoRoot, writeJson } from "./io.ts";

const input = readStdinJson<{ loop_count?: number }>();
const loopCount = input.loop_count ?? 0;

const root = repoRoot();

// テンプレ既定はルートの pnpm スクリプト。turbo 化する手順は docs/ai-harness.md を参照。
const checks: { command: string; args: string[]; cwd: string }[] = [
  { command: "pnpm", args: ["fmt:check"], cwd: root },
  { command: "pnpm", args: ["lint"], cwd: root },
  { command: "pnpm", args: ["typecheck"], cwd: root },
  { command: "pnpm", args: ["dead-code"], cwd: root },
];

// language-teacher 由来: Rust 面があるときだけ cargo ゲートを足す。
const rustDir = join(root, "apps", "app", "src-tauri");
if (existsSync(rustDir)) {
  checks.push(
    { command: "cargo", args: ["fmt", "--check"], cwd: rustDir },
    {
      command: "cargo",
      args: ["clippy", "--all-targets", "--", "-D", "warnings"],
      cwd: rustDir,
    },
    { command: "cargo", args: ["test"], cwd: rustDir },
  );
}

const chunks: string[] = [];
let failed = false;

for (const check of checks) {
  const result = spawnSync(check.command, check.args, {
    cwd: check.cwd,
    encoding: "utf8",
    env: hookEnv(),
    shell: true,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
    .replaceAll("\r\n", "\n")
    .trim();
  if (output) chunks.push(output);
  if (result.error) {
    chunks.push(String(result.error));
    failed = true;
    break;
  }
  if (result.status !== 0) {
    failed = true;
    break;
  }
}

const output = chunks.join("\n").trim();

if (failed && loopCount < 3) {
  writeJson({
    followup_message: `Check failed:\n${output.slice(0, 4000)}\nエラーを修正してください。`,
  });
} else {
  writeJson({});
}
