import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { handleRequest } from "./internal/controller/http.ts";
import { connectRedisJobStore } from "./internal/infra/redis-job-store.ts";

const port = Number(process.env.PORT ?? 8080);

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
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required");
  }

  console.log("starting worker");
  const store = await connectRedisJobStore(redisUrl);
  const deps = {
    expectedSecret: process.env.WORKER_SECRET ?? "",
    accept: { store },
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
      console.error(error);
      if (!res.headersSent) {
        json(res, 500, { error: "internal" });
      }
    }
  });

  const shutdown = () => {
    server.close(async () => {
      await store.close();
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  server.listen(port, "0.0.0.0", () => {
    console.log(`worker listening on ${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
