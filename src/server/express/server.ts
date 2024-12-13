import dotenv from "dotenv";
dotenv.config({ override: true });
import { createServer, Server as NetServer } from "http";
import app from "./restApi";
import { Server as SocketServer } from "socket.io";
import { getORM } from "utils/mikro";
import { globalValues } from "./global";
import { setupSocketIO } from "./sockets";
import serverLogger from "utils/serverLogger";

const port = 3001;

// start the database connection
getORM();

// parent http server
const server: NetServer = createServer();
// express request handler
server.on("request", app);
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

server.listen(port, () => {
  serverLogger.info({ logId: "api-restart" });
});
