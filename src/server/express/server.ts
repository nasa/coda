import dotenv from "dotenv";
dotenv.config();
import { createServer, Server as NetServer } from "http";
import app from "./restApi";

// parent http server
const server: NetServer = createServer();

// express request handler
server.on("request", app);

// hard-coded port to 2000 for simplicity until more flexibility needed
server.listen(2000, () => {
  console.log(`http server (re)started`);
});
