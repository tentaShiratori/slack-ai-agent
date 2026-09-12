import { afterEach, expect, test } from "vitest";
import { errorFields, log } from "./logger.ts";

const originalLog = console.log;
const originalError = console.error;
const originalService = process.env.SERVICE_NAME;

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
  if (originalService === undefined) {
    delete process.env.SERVICE_NAME;
  } else {
    process.env.SERVICE_NAME = originalService;
  }
});

function captureStd(kind: "log" | "error"): string[] {
  const lines: string[] = [];
  const write = (value: unknown) => {
    lines.push(String(value));
  };
  if (kind === "log") {
    console.log = write;
  } else {
    console.error = write;
  }
  return lines;
}

test("INFO は JSON を stdout に出す", () => {
  process.env.SERVICE_NAME = "worker";
  const lines = captureStd("log");
  const raw = log("INFO", "starting", { requestId: "r1" });
  const parsed = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
  expect(raw).toBe(lines[0]);
  expect(parsed.severity).toBe("INFO");
  expect(parsed.message).toBe("starting");
  expect(parsed.requestId).toBe("r1");
  expect(parsed.service).toBe("worker");
  expect(typeof parsed.timestamp).toBe("string");
});

test("WARNING は stdout に出す", () => {
  const lines = captureStd("log");
  log("WARNING", "slow");
  expect(JSON.parse(lines[0] ?? "").severity).toBe("WARNING");
});

test("ERROR は stderr に出す", () => {
  const lines = captureStd("error");
  log("ERROR", "failed");
  expect(JSON.parse(lines[0] ?? "").severity).toBe("ERROR");
  expect(JSON.parse(lines[0] ?? "").message).toBe("failed");
});

test("CRITICAL は stderr に出す", () => {
  const lines = captureStd("error");
  log("CRITICAL", "down");
  expect(JSON.parse(lines[0] ?? "").severity).toBe("CRITICAL");
});

test("fields の severity より引数を優先する", () => {
  const lines = captureStd("log");
  log("INFO", "ok", { severity: "ERROR", message: "nope" });
  const parsed = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
  expect(parsed.severity).toBe("INFO");
  expect(parsed.message).toBe("ok");
});

test("循環参照はシリアライズ失敗として ERROR になる", () => {
  const lines = captureStd("error");
  const fields: Record<string, unknown> = {};
  fields.self = fields;
  log("INFO", "cycle", fields);
  const parsed = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
  expect(parsed.severity).toBe("ERROR");
  expect(parsed.message).toBe("failed to serialize log entry");
  expect(parsed.originalMessage).toBe("cycle");
});

test("Error から errorFields を取る", () => {
  const error = new Error("boom");
  error.name = "TestError";
  expect(errorFields(error)).toEqual({
    errorName: "TestError",
    errorMessage: "boom",
    errorStack: error.stack,
  });
});

test("Error 以外は文字列にする", () => {
  expect(errorFields("nope")).toEqual({ errorMessage: "nope" });
  expect(errorFields(41)).toEqual({ errorMessage: "41" });
});
