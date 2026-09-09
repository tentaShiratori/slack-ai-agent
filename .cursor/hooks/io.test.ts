import { expect, test } from "vitest";
import { parseStdinJson } from "./io.ts";

test("JSON をオブジェクトにする", () => {
  expect(parseStdinJson('{"file_path":"a.ts"}')).toEqual({ file_path: "a.ts" });
});

test("先頭の BOM を除いてパースする", () => {
  expect(parseStdinJson('\uFEFF{"file_path":"a.ts"}')).toEqual({ file_path: "a.ts" });
});

test("空は空オブジェクト", () => {
  expect(parseStdinJson("")).toEqual({});
});

test("空白だけは空オブジェクト", () => {
  expect(parseStdinJson("  \n\t")).toEqual({});
});

test("BOM だけは空オブジェクト", () => {
  expect(parseStdinJson("\uFEFF")).toEqual({});
});

test("前後の空白を除いてパースする", () => {
  expect(parseStdinJson('  {"file_path":"a.ts"}  \n')).toEqual({ file_path: "a.ts" });
});

test("不正な JSON は投げる", () => {
  expect(() => parseStdinJson("{")).toThrow(SyntaxError);
});
