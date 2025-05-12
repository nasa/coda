import dotenv from "dotenv";
dotenv.config({ override: true });
import { createServer } from "http";
import app from "./restApi";
import { Server as SocketServer } from "socket.io";
import { getORM } from "utils/mikro";
import { globalValues } from "./global";
import { setupSocketIO } from "./sockets";
import serverLogger from "utils/serverLogger";
import { ConsoleLogger } from "../../utils/logger";

const port = 3001;

// enable console logging on the server side based on the environment variable
if (process.env.SHOW_CLG === "true") ConsoleLogger.enable();

// start the database connection
getORM();

// Create server
const server = createServer();
server.on("request", app);

// Start Socket.IO
console.log("*Starting Socket.IO");
globalValues.socketio = new SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  transports: ["websocket"],
  path: "/api/v1/socketio",
  addTrailingSlash: false,
});

setupSocketIO();

// Start the server
server.listen(port, () => {
  serverLogger.info({ logId: "api-restart" });
});

// Simple shutdown handler
const gracefulShutdown = async () => {
  console.log("Gracefully shutting down server...");

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
    const orm = await getORM();
    await orm.close();
    console.log("Database connections closed");
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
