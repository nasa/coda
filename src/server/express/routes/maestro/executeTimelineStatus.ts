import getMaestroExecuteTimelineStatus from "server/maestro/maestro";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

const router = express.Router();

const parseQuery = (query: Query) => {
  const { uuid } = query;
  const queryObj = {
    uuid: uuid ? (uuid as string) : undefined,
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const response = await getMaestroExecuteTimelineStatus(queryObj.uuid);
    res.status(200).json(response);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
