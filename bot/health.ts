import { createServer } from "node:http";

import { type Client, Status } from "discord.js";

/**
 * Liveness endpoint for the container runtime, bound to localhost only.
 * 200 while the gateway connection is up, 503 otherwise. ECS's health check
 * (and Docker's HEALTHCHECK) call it; nothing outside the task can reach it.
 */
export function startHealthServer(client: Client, port = Number(process.env.HEALTH_PORT) || 8080) {
  const server = createServer((req, res) => {
    if (req.url !== "/health") {
      res.writeHead(404).end();
      return;
    }
    const ok = client.isReady() && client.ws.status === Status.Ready;
    res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok, ws: client.ws.status, ping: client.ws.ping, guilds: client.guilds.cache.size }));
  });
  server.listen(port, "127.0.0.1", () => console.log(`health endpoint on http://127.0.0.1:${port}/health`));
  return server;
}
