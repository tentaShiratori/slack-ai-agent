import { homedir } from "node:os";
import { join } from "node:path";

// フックの Node プロセスには mise の PATH が載らない。cargo の bin を足して PATH から起動する。
// CI=true は TTY 無しの pnpm が node_modules 再作成の確認で止まらないようにする。
export function hookEnv(
  env: NodeJS.ProcessEnv = process.env,
  home: () => string = homedir,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const cargoBin = join(env.CARGO_HOME ?? join(home(), ".cargo"), "bin");
  const pathKey =
    platform === "win32"
      ? (Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "Path")
      : "PATH";
  const delim = platform === "win32" ? ";" : ":";
  const current = env[pathKey] ?? "";
  return {
    ...env,
    CI: "true",
    [pathKey]: current ? `${cargoBin}${delim}${current}` : cargoBin,
  };
}
