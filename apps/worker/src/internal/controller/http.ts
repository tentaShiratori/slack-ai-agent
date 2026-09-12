import { timingSafeEqual } from "node:crypto";
import { acceptJob, LockTimeoutError, type AcceptJobDeps } from "../usecase/accept-job.ts";
import { JobParseError, parseJob } from "../parse-job.ts";

export type WorkerRequest = {
  method: string;
  url: string;
  workerSecret: string | undefined;
  rawBody: string;
};

export type WorkerResponse = {
  status: number;
  body: unknown;
};

export type HttpDeps = {
  expectedSecret: string;
  accept: AcceptJobDeps;
};

function pathOf(url: string): string {
  return url.split("?")[0] ?? "/";
}

function secretsEqual(provided: string | undefined, expected: string): boolean {
  if (!expected) {
    return false;
  }
  const a = Buffer.from(provided ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function parseJsonBody(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new JobParseError("invalid_json");
  }
}

async function handleJobs(req: WorkerRequest, deps: HttpDeps): Promise<WorkerResponse> {
  if (!secretsEqual(req.workerSecret, deps.expectedSecret)) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  try {
    const job = parseJob(parseJsonBody(req.rawBody));
    const result = await acceptJob(job, deps.accept);
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof JobParseError) {
      return { status: 400, body: { error: error.message } };
    }
    if (error instanceof LockTimeoutError) {
      return { status: 503, body: { error: "lock_timeout" } };
    }
    throw error;
  }
}

export async function handleRequest(req: WorkerRequest, deps: HttpDeps): Promise<WorkerResponse> {
  const path = pathOf(req.url);
  if (req.method === "GET" && (path === "/health" || path === "/")) {
    return { status: 200, body: { ok: true, role: "worker" } };
  }
  if (req.method === "POST" && path === "/jobs") {
    return handleJobs(req, deps);
  }
  return { status: 404, body: { error: "not_found" } };
}
