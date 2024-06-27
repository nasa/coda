import dotenv from "dotenv";
dotenv.config();
import { createServer, Server as NetServer } from "http";
import app from "./restApi";
import { getORM } from "utils/mikro";

const port = 3001;

// start the database connection
getORM();

// parent http server
const server: NetServer = createServer();

// express request handler
server.on("request", app);

server.listen(port, () => {
  console.log(`http server (re)started on ${port}`);
});
