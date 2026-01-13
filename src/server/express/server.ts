import "utils/loadEnv";
import { createServer } from "http";
import app from "./restApi";
import { Server as SocketServer } from "socket.io";
import { globalValues } from "./global";
import { setupSocketIO } from "./sockets";
import { initTalkybotS2sSocket, disconnectTalkybotS2sSocket } from "./talkybotS2sSocket";
import { startSpacetrackScheduler, stopSpacetrackScheduler } from "./spacetrackScheduler";
import serverLogger from "utils/logging/serverLogger";
import { ConsoleLogger } from "../../utils/logging/consoleLogger";
import config from "server/database/mikro-orm.config";
import { MikroORM } from "@mikro-orm/postgresql";

// start the database connection
globalValues.orm = await MikroORM.init(config);

// Create server
const server = createServer();

// Start Socket.IO
ConsoleLogger.info("*Starting Socket.IO");
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

// Start the server
server.listen(3001, () => {
  serverLogger.info({ logId: "api-restart" });

  // Start Space-Track TLE update scheduler
  void startSpacetrackScheduler();

  // Initialize server-to-server socket connection to Talkybot
  const talkybotS2sSocket = initTalkybotS2sSocket();
  if (talkybotS2sSocket) {
    globalValues.talkybotS2sSocket = talkybotS2sSocket;
    ConsoleLogger.info("TalkybotS2s Socket to Talkybot initialized");
  }
});

// Simple shutdown handler
const gracefulShutdown = async () => {
  ConsoleLogger.info("Gracefully shutting down server...");

  // Stop Space-Track scheduler
  stopSpacetrackScheduler();

  // Stop socket status interval
  if (globalValues.socketInterval) {
    clearInterval(globalValues.socketInterval);
    globalValues.socketInterval = null;
    ConsoleLogger.info("Socket status interval stopped");
  }

  // Disconnect TalkybotS2s socket to Talkybot
  disconnectTalkybotS2sSocket();
  globalValues.talkybotS2sSocket = null;
  ConsoleLogger.info("TalkybotS2s Socket disconnected");

  // Close Socket.IO first
  if (globalValues.socketio) {
    await new Promise<void>((resolve) => {
      globalValues.socketio.close(() => {
        ConsoleLogger.info("Socket.IO server closed");
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
            ConsoleLogger.warn("Server was already closed");
            resolve();
          } else {
            ConsoleLogger.error("Error closing HTTP server:", err);
            reject(err);
          }
        } else {
          ConsoleLogger.info("HTTP server closed");
          resolve();
        }
      });
    });
  } catch (err) {
    // Just log the error, but continue shutdown
    ConsoleLogger.warn("Server might already be closed:", err);
  }

  // Close database connections
  try {
    if (globalValues.orm) {
      await globalValues.orm.close();
      ConsoleLogger.info("Database connections closed");
    }
  } catch (err) {
    ConsoleLogger.error("Error closing database connection:", err);
  }

  ConsoleLogger.info("Shutdown complete");
};

// Handle process events
if (typeof process !== "undefined") {
  process.on("message", (msg) => {
    if (msg === "shutdown") {
      gracefulShutdown().catch(ConsoleLogger.error);
    }
  });

  // Handle termination signals
  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGUSR2", gracefulShutdown);
}
