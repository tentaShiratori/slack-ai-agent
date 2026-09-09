import { createServer } from "node:http";

const port = 8080;

async function main() {
  console.log("starting worker");

  const server = createServer(async (_req, _res) => {});
  server.listen(port, "0.0.0.0", () => {
    console.log(`worker (Cloud Run stand-in) listening on ${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
