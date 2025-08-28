import express, { Request, Response, Router } from "express";

const router: Router = express.Router();

router.get("/", (req: Request, res: Response) => {
  try {
    const currentTime = new Date().toISOString();
    res.json({ time: currentTime });
  } catch (error) {
    res.status(500).json({ error: "Failed to get server time" });
  }
});

export default router;
