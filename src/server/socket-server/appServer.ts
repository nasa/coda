import dotenv from "dotenv";
dotenv.config({ override: true });

import express, { Express } from "express";

const createAppServer = (): Express => {
  console.log("Starting App Server");
  if (process.env.SERVER_DATA_DIR) {
    console.log(process.env.SERVER_DATA_DIR);
  }

  const app = express();

  app.use(express.json({ limit: "20mb" }));

  app.use((req, res, next) => {
    // eslint-disable-next-line no-console
    console.log(req.url);
    next();
  });

  app.set("json spaces", 2);

  // Serve a successful response. For use with wait-on
  app.get("/api/v1/health", (req, res) => {
    res.send({ status: "ok" });
  });

  return app;
};

export default createAppServer;
