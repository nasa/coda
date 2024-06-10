import express, { Request, Response } from "express";
import { globalValues } from "server/express/global";

const router = express.Router();

// set emssVideoEnabled or disabled based on parameter
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const { enable } = req.query;
  if (enable === "true") {
    globalValues.emssVideoEnabled = true;
  } else if (enable === "false") {
    globalValues.emssVideoEnabled = false;
  }
  res.status(200).json({ emssVideoEnabled: globalValues.emssVideoEnabled });
  return;
});

export default router;
