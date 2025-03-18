import express from "express";
import {
  expressProfilingStart,
  expressProfilingStop,
  expressProfilingUI,
} from "packages/onDemandProfiler";
import { onlyEmssSuperuser } from "../user/auth";

const router = express.Router();

router.get("/", async (req, res) => {
  const user = onlyEmssSuperuser(req);
  if (!user) {
    res.status(401).send({ error: "not authorized" });
    return;
  }

  expressProfilingUI(res);
});

router.post("/start", async (req, res) => {
  const user = onlyEmssSuperuser(req);
  if (!user) {
    res.status(401).send({ error: "not authorized" });
    return;
  }

  await expressProfilingStart(res, user);
});

router.post("/stop", async (req, res) => {
  const user = onlyEmssSuperuser(req);
  if (!user) {
    res.status(401).send({ error: "not authorized" });
    return;
  }

  await expressProfilingStop(res, user);
});

export default router;
