import { expect, test, vi } from "vitest";
import { createHttpDispatcher } from "./http-dispatch.ts";

test("HTTP dispatch は worker の完了を待たない", async () => {
  let finished = false;
  const fetchFn = vi.fn<typeof fetch>(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 80);
    });
    finished = true;
    return new Response("{}", { status: 200 });
  });
  const enqueue = createHttpDispatcher(
    { workerUrl: "http://127.0.0.1:8080/", workerSecret: "dev-secret" },
    fetchFn,
  );
  const rawBody = JSON.stringify({ event_id: "evt-1" });
  await enqueue(rawBody);
  expect(finished).toBe(false);
  expect(fetchFn).toHaveBeenCalledWith("http://127.0.0.1:8080/jobs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": "dev-secret",
    },
    body: rawBody,
  });
});

test("HTTP dispatch の失敗は未処理にしない", async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => {
    throw new Error("econnrefused");
  });
  const enqueue = createHttpDispatcher({ workerUrl: "http://127.0.0.1:8080", workerSecret: "" }, fetchFn);
  await expect(enqueue("{}")).resolves.toBeUndefined();
});
