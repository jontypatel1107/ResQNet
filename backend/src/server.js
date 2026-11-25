import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app.js";
import connectDB from "./config/database.js";
import { initSocket } from "./config/socket.js";
import { seedDemoUsers } from "./utils/seedDemoUsers.js";

const PREFERRED_PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";
const FALLBACK_ATTEMPTS = Math.max(1, Number(process.env.PORT_FALLBACK_ATTEMPTS) || 8);

const buildPortCandidates = () => {
  const ports = [];
  for (let offset = 0; offset < FALLBACK_ATTEMPTS; offset += 1) {
    const port = PREFERRED_PORT + offset;
    if (port > 65535) break;
    ports.push(port);
  }
  return ports;
};

const listenOnce = (server, port) =>
  new Promise((resolve, reject) => {
    const cleanup = () => {
      server.off("error", onError);
      server.off("listening", onListening);
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onListening = () => {
      cleanup();
      resolve(port);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, HOST);
  });

const startServer = async () => {
  await connectDB();

  const shouldSeedDemo =
    process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_ON_START !== "false";
  if (shouldSeedDemo) {
    try {
      await seedDemoUsers();
    } catch (error) {
      console.warn(`[ResQNet] Demo account seed skipped: ${error.message}`);
    }
  }

  const server = http.createServer(app);
  initSocket(server);

  let actualPort = null;
  const busyPorts = [];

  for (const port of buildPortCandidates()) {
    try {
      actualPort = await listenOnce(server, port);
      break;
    } catch (error) {
      if (error.code === "EADDRINUSE") {
        busyPorts.push(port);
        console.warn(`[ResQNet] Port ${port} is busy. Trying ${port + 1}...`);
        continue;
      }
      throw error;
    }
  }

  if (actualPort === null) {
    throw new Error(
      `No free port found in ${PREFERRED_PORT}-${PREFERRED_PORT + FALLBACK_ATTEMPTS - 1}. ` +
        `Set PORT or PORT_FALLBACK_ATTEMPTS in backend/.env.`
    );
  }

  // Health responses and logs report the port that was actually bound.
  process.env.RESQNET_ACTUAL_PORT = String(actualPort);

  server.on("error", (error) => {
    console.error("[ResQNet] Server error:", error);
  });

  console.log(`[ResQNet] Server running on port ${actualPort} (${HOST}:${actualPort})`);
  if (busyPorts.length) {
    console.warn(
      `[ResQNet] Busy port(s) skipped: ${busyPorts.join(", ")}. ` +
        `Mobile clients auto-discover the active port via /api/health.`
    );
  }
  console.log(`[ResQNet] Environment: ${process.env.NODE_ENV || "development"}`);

  const shutdown = () => {
    server.close(() => {
      console.log("[ResQNet] Server stopped gracefully.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

startServer().catch((error) => {
  console.error(`[ResQNet] Failed to start: ${error.message}`);
  process.exit(1);
});
