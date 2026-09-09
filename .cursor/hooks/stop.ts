import { spawnSync } from "node:child_process";
import { readStdinJson, repoRoot, writeJson } from "./io.ts";

const input = readStdinJson<{ loop_count?: number }>();
const loopCount = input.loop_count ?? 0;

const root = repoRoot();

const checks: { args: string[]; cwd: string }[] = [
  {
    args: ["fmt:check"],
    cwd: root,
  },
  {
    args: ["lint"],
    cwd: root,
  },
  {
    args: ["dead-code"],
    cwd: root,
  },
];

const chunks: string[] = [];
let failed = false;

for (const check of checks) {
  // Windows: pnpm は .cmd/.ps1 シムのため shell 経由で起動する
  const result = spawnSync("pnpm", check.args, {
    cwd: check.cwd,
    encoding: "utf8",
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
