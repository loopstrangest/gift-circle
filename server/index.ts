import { createServer } from "node:http";
import { parse } from "node:url";

import next from "next";

import { initializeRealtime } from "@/server/realtime";

async function main() {
  const dev = process.argv.includes("dev") || process.env.NODE_ENV !== "production";
  const hostname = process.env.HOSTNAME ?? "localhost";
  const port = Number(process.env.PORT) || 3000;

  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl);
  });

  initializeRealtime(httpServer);

  httpServer.listen(port, () => {
    console.log(`Gift Circle server ready on http://${hostname}:${port}`);
  });
}

main().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
