import "utils/loadEnv";
import { createServer } from "http";
import app from "./restApi";
import { Server as SocketServer } from "socket.io";
import { globalValues } from "./global";
import { setupSocketIO } from "./sockets";
import serverLogger from "utils/serverLogger";
import { ConsoleLogger } from "../../utils/consoleLogger";
import config from "server/database/mikro-orm.config";
import { MikroORM } from "@mikro-orm/postgresql";
import { updateFromCelestrak } from "server/processing/ephemeris-celestrak";

// enable console logging on the server side based on the environment variable
if (process.env.SHOW_CLG === "true") ConsoleLogger.enable();

// Wrap in async IIFE to handle top-level await
(async () => {
  // start the database connection
  globalValues.orm = await MikroORM.init(config);

  // Create server
  const server = createServer();

  // Start Socket.IO
  console.log("*Starting Socket.IO");
  globalValues.socketio = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    {}
  >(server, {
    transports: ["websocket"],
    path: "/api/v1/socketio",
    addTrailingSlash: false,
  });

  // these values are defined in esbuild.mjs and populated at build time
  globalValues.appVersion = {
    version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown",
    gitCommit: typeof __GIT_COMMIT__ !== "undefined" ? __GIT_COMMIT__ : "unknown",
  };

  setupSocketIO();

  // express request handler
  server.on("request", app);

  // Celestrak TLE update scheduler - runs regardless of user activity
  const CELESTRAK_UPDATE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  let celestrakInterval: NodeJS.Timeout | null = null;

  const startCelestrakScheduler = () => {
    // Initial update on startup. "void" on this "fire and forget" call to explicitly ignore returned Promise
    void updateFromCelestrak();

    celestrakInterval = setInterval(() => {
      void updateFromCelestrak();
    }, CELESTRAK_UPDATE_INTERVAL_MS);

    ConsoleLogger.log("Celestrak TLE update scheduler started (30 minute interval)");
  };

  // Start the server
  server.listen(3001, () => {
    serverLogger.info({ logId: "api-restart" });
    startCelestrakScheduler();
  });

  // Simple shutdown handler
  const gracefulShutdown = async () => {
    console.log("Gracefully shutting down server...");

    // Stop Celestrak scheduler
    if (celestrakInterval) {
      clearInterval(celestrakInterval);
      console.log("Celestrak scheduler stopped");
    }

    // Close Socket.IO first
    if (globalValues.socketio) {
      await new Promise<void>((resolve) => {
        globalValues.socketio.close(() => {
          console.log("Socket.IO server closed");
          resolve();
        });
      });
    }

    // Close the HTTP server
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            // Check for ERR_SERVER_NOT_RUNNING with proper type checking
            if (err instanceof Error && "code" in err && err.code === "ERR_SERVER_NOT_RUNNING") {
              console.log("Server was already closed");
              resolve();
            } else {
              console.error("Error closing HTTP server:", err);
              reject(err);
            }
          } else {
            console.log("HTTP server closed");
            resolve();
          }
        });
      });
    } catch (err) {
      // Just log the error, but continue shutdown
      console.log("Server might already be closed:", err);
    }

    // Close database connections
    try {
      if (globalValues.orm) {
        await globalValues.orm.close();
        console.log("Database connections closed");
      }
    } catch (err) {
      console.error("Error closing database connection:", err);
    }

    console.log("Shutdown complete");
  };

  // Handle process events
  if (typeof process !== "undefined") {
    process.on("message", (msg) => {
      if (msg === "shutdown") {
        gracefulShutdown().catch(console.error);
      }
    });

    // Handle termination signals
    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGUSR2", gracefulShutdown);
  }
})().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
