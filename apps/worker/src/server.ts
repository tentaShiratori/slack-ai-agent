import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const port = Number(process.env.PORT ?? 8080);

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

async function main() {
  console.log("starting worker");

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    if (req.method === "GET" && (url === "/health" || url === "/")) {
      json(res, 200, { ok: true, role: "worker" });
      return;
    }
    json(res, 404, { error: "not_found" });
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`worker (Cloud Run stand-in) listening on ${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
