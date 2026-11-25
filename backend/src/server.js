import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app.js";
import connectDB from "./config/database.js";
import { initSocket } from "./config/socket.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to Database
  await connectDB();

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize Socket.io
  initSocket(server);

  let retries = 0;
  const maxRetries = 5;

  // Handle server errors with auto-retry for Windows socket release delays
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      retries++;
      if (retries <= maxRetries) {
        console.warn(`[ResQNet] Port ${PORT} is temporarily busy. Retrying in 1s (${retries}/${maxRetries})...`);
        setTimeout(() => {
          try {
            server.close();
          } catch {}
          server.listen(PORT, "0.0.0.0");
        }, 1000);
      } else {
        console.error(`\n[ResQNet] ⚠️ Error: Port ${PORT} is still in use after ${maxRetries} retries.`);
        console.error(`[ResQNet] To fix: Close any duplicate terminal running node, or run:`);
        console.error(`          Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
        process.exit(1);
      }
    } else {
      console.error("[ResQNet] Server error:", error);
    }
  });

  // Start listening
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[ResQNet] Server running on port ${PORT} (0.0.0.0:${PORT})`);
    console.log(`[ResQNet] Environment: ${process.env.NODE_ENV || "development"}`);
  });

  // Graceful shutdown on termination
  process.on("SIGTERM", () => {
    server.close(() => {
      console.log("[ResQNet] Server stopped gracefully.");
    });
  });
};

startServer();
