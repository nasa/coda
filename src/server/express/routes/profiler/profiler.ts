import express from "express";
import {
  expressProfilingStart,
  expressProfilingStop,
  expressProfilingUI,
} from "packages/onDemandProfiler";
import { getUser } from "packages/getUser";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";

const router = express.Router();

router.get("/", requireSuperuser, async (req, res) => {
  expressProfilingUI(res);
});

router.post("/start", requireSuperuser, async (req, res) => {
  const user = getUser(req);
  if (user instanceof Error) return;
  await expressProfilingStart(res, user);
});

router.post("/stop", requireSuperuser, async (req, res) => {
  const user = getUser(req);
  if (user instanceof Error) return;
  await expressProfilingStop(res, user);
});

export default router;
