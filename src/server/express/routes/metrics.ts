import type { RequestHandler } from "express";

import express from "express";
import * as prometheus from "prom-client";

const router = express.Router();

prometheus.collectDefaultMetrics();

const keyAuthorization: RequestHandler = (req, res, next) => {
  const serviceKey = req.headers["x-api-key"];

  if (!serviceKey || typeof serviceKey !== "string") {
    res.status(401).json({ error: "missing API key" });
    return;
  }

  const key = process.env.EMSS_TOKEN;
  if (!key) {
    res.status(500).json({ error: "unable to verify API key" });
    return;
  }

  if (serviceKey !== key) {
    res.status(403).json({ error: "invalid API key" });
    return;
  }

  next();
};

router.get("/", keyAuthorization, async (_req, res) => {
  try {
    res.set("Content-Type", prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
  } catch {
    res.end("");
  }
});

export default router;
