import http from "node:http";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { redis } from "./db/redis.js";
import { app } from "./app.js";
import { wsHub } from "./ws/hub.js";

const server = http.createServer(app);
wsHub.init(server);

server.listen(env.PORT, () => {
  console.log(`API server started on http://localhost:${env.PORT}`);
});

async function shutdown(): Promise<void> {
  console.log("Shutting down...");
  await Promise.all([prisma.$disconnect(), redis.quit()]);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => {
  void shutdown();
});

process.on("SIGINT", () => {
  void shutdown();
});
