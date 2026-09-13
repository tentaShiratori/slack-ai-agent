import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { env } from "./env.ts";
import { handleRequest } from "./internal/controller/http.ts";
import { createCursorGrill, createCursorPrompt } from "./internal/infra/cursor-agent.ts";
import { createGitHubClient, githubConfigFromEnv } from "./internal/infra/github-client.ts";
import { connectRedisJobStore } from "./internal/infra/redis-job-store.ts";
import { createSlackPoster } from "./internal/infra/slack/post-message.ts";
import { fileSlashReport } from "./internal/usecase/file-report.ts";
import { organizeSlashReport } from "./internal/usecase/organize-report.ts";
import { replyMentionHelp } from "./internal/usecase/reply-mention-help.ts";
import { runGrillSession } from "./internal/usecase/run-grill.ts";
import { errorFields, log } from "./logger.ts";
import { captureException, flushSentry, initSentry } from "./sentry.ts";

process.env.SERVICE_NAME ??= env.SERVICE_NAME ?? "worker";

const port = env.PORT;

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === "string" ? value : undefined;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

async function main() {
  initSentry({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
  });

  log("INFO", "starting worker");
  const store = await connectRedisJobStore(env.REDIS_URL);
  const slack = createSlackPoster(env.SLACK_BOT_TOKEN);
  const github = createGitHubClient(githubConfigFromEnv(env));
  const prompt = createCursorPrompt(env.CURSOR_API_KEY, env.GITHUB_DEFAULT_REPO);
  const grill = createCursorGrill(env.CURSOR_API_KEY, env.GITHUB_DEFAULT_REPO);
  const deps = {
    expectedSecret: env.WORKER_SECRET,
    accept: {
      store,
      github,
      process: async ({ job, sessionId }) => {
        const grilled = await runGrillSession(job, {
          sessionId,
          store,
          github,
          slack,
          turn: grill,
          onError: (error) => {
            captureException(error);
            log("ERROR", "grill failed", errorFields(error));
          },
        });
        if (!grilled) {
          await replyMentionHelp(job, slack);
        }
        await fileSlashReport(job, {
          github,
          slack,
          organize: (report) => organizeSlashReport(report, prompt),
          onError: (error) => {
            captureException(error);
            log("ERROR", "slash report failed", errorFields(error));
          },
        });
      },
    },
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const rawBody = req.method === "POST" ? await readBody(req) : "";
      const result = await handleRequest(
        {
          method: req.method ?? "GET",
          url: req.url ?? "/",
          workerSecret: header(req, "x-worker-secret"),
          rawBody,
        },
        deps,
      );
      json(res, result.status, result.body);
    } catch (error) {
      captureException(error);
      log("ERROR", "unhandled request error", errorFields(error));
      if (!res.headersSent) {
        json(res, 500, { error: "internal" });
      }
    }
  });

  const shutdown = () => {
    server.close(async () => {
      await store.close();
      await flushSentry();
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  server.listen(port, "0.0.0.0", () => {
    log("INFO", "worker listening", { port });
  });
}

main().catch(async (error: unknown) => {
  captureException(error);
  log("CRITICAL", "worker failed to start", errorFields(error));
  await flushSentry();
  process.exit(1);
});
