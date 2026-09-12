import { jobsUrl } from "./cloud-tasks.ts";

export type HttpDispatchConfig = {
  workerUrl: string;
  workerSecret: string;
};

export function createHttpDispatcher(
  config: HttpDispatchConfig,
  fetchFn: typeof fetch = fetch,
): (rawBody: string) => Promise<void> {
  const url = jobsUrl(config.workerUrl);

  return async (rawBody: string) => {
    const pending = fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-worker-secret": config.workerSecret,
      },
      body: rawBody,
    });
    void pending.catch(() => undefined);
  };
}
