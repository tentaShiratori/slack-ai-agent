import { expect, test } from "vitest";
import { join } from "node:path";
import { hookEnv } from "./hook_env.ts";

test("CI を true にする", () => {
  expect(hookEnv({ PATH: "/usr/bin" }, () => "/home/me", "linux").CI).toBe("true");
});

test("CARGO_HOME の bin を PATH の先頭に足す", () => {
  const env = hookEnv(
    { CARGO_HOME: "/opt/cargo", PATH: "/usr/bin" },
    () => "/home/me",
    "linux",
  );
  expect(env.PATH).toBe(`${join("/opt/cargo", "bin")}:/usr/bin`);
});

test("CARGO_HOME が無いときはホームの .cargo/bin を使う", () => {
  const env = hookEnv({ PATH: "/usr/bin" }, () => "/home/me", "linux");
  expect(env.PATH).toBe(`${join("/home/me", ".cargo", "bin")}:/usr/bin`);
});

test("PATH が空なら cargo の bin だけになる", () => {
  const env = hookEnv({ CARGO_HOME: "/opt/cargo" }, () => "/home/me", "linux");
  expect(env.PATH).toBe(join("/opt/cargo", "bin"));
});

test("win32 では既存の Path を更新し PATH は増やさない", () => {
  const env = hookEnv(
    { CARGO_HOME: "C:\\cargo", Path: "C:\\Windows" },
    () => "C:\\Users\\me",
    "win32",
  );
  expect(env.Path).toBe(`${join("C:\\cargo", "bin")};C:\\Windows`);
  expect(env.PATH).toBeUndefined();
});
