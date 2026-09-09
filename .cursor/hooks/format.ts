import { spawnSync } from "node:child_process";
import { extname, join } from "node:path";
import { readStdinJson, repoRoot } from "./io.ts";

const input = readStdinJson<{ file_path?: string }>();
const filePath = input.file_path ?? "";
const ext = extname(filePath).toLowerCase();

if (filePath && [".ts", ".tsx", ".md"].includes(ext)) {
  const oxfmt = join(repoRoot(), "node_modules", "oxfmt", "bin", "oxfmt");
  spawnSync(process.execPath, [oxfmt, filePath], {
    cwd: repoRoot(),
    windowsHide: true,
  });
}
