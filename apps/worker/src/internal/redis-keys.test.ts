import { expect, test } from "vitest";
import { eventKey, lockKey, threadSessionKey } from "./redis-keys.ts";

test("event キーは architecture の形式", () => {
  expect(eventKey("evt-1")).toBe("slack:event:evt-1");
});

test("lock キーは channel と ts を含む", () => {
  expect(lockKey("C123", "1.0")).toBe("slack:lock:C123:1.0");
});

test("session キーは channel と ts を含む", () => {
  expect(threadSessionKey("C123", "1.0")).toBe("slack:thread:C123:1.0");
});

test("空文字でもプレフィックスは付ける", () => {
  expect(eventKey("")).toBe("slack:event:");
  expect(lockKey("", "")).toBe("slack:lock::");
  expect(threadSessionKey("", "")).toBe("slack:thread::");
});

test("コロンを含む id はそのまま連結する", () => {
  expect(eventKey("a:b")).toBe("slack:event:a:b");
  expect(lockKey("C:1", "1:2")).toBe("slack:lock:C:1:1:2");
});
