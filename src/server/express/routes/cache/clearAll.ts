import { clearAll } from "server/processing/cache-client";
import express, { Request, Response } from "express";

/**
 * `/api/cache/clearAll`
 *
 * Nuke everything in the cache
 */
const router = express.Router();

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    await clearAll();
    res.status(200).json({ success: true });
    return;
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.toString() });
    return;
  }
});

export default router;
