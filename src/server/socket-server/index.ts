import dotenv from "dotenv";
dotenv.config({ override: true });

import { createServer } from "http";
import createAppServer from "./appServer";
import { Server as SocketServer } from "socket.io";
import { setupSocketIO } from "./sockets";
import { globalValues } from "./global";
import { getORM } from "utils/mikro";

const port = 5001;
const server = createServer();
const app = createAppServer();

getORM();

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
  // eslint-disable-next-line no-console
  console.log(`API started on port ${port}.`);
});
