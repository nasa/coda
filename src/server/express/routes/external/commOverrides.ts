import express, { Request, Response } from "express";
import getCommOverrides from "server/processing/commOverrides";
import { getSourcesWithDataType } from "utils/sourceDataTypeMap";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Legacy comm overrides for the comm pane.
 *
 * The comm pane fetches live audio/transcripts directly from Talkybot; this endpoint
 * supplements that with CODA's DB-backed legacy overrides (JETT5/MS1/MS2, etc.) for a
 * given source + date. Returns FetchResponse<TbAudioFileConverted[]> (data may be []).
 * Public data only — see server/processing/commOverrides.ts.
 */
const router = express.Router();

const DATE_RE = /^(19|20)\d\d-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/;

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const source = req.query.source as Source | undefined;
  const dateWanted = req.query.date as string | undefined;

  if (!source || !getSourcesWithDataType("talkybot").includes(source)) {
    res.status(400).json({ status: "error", message: "Invalid or missing source" });
    return;
  }
  if (!dateWanted || !DATE_RE.test(dateWanted)) {
    res
      .status(400)
      .json({ status: "error", message: "Invalid or missing date (expected YYYY-MM-DD)" });
    return;
  }

  try {
    const response = await getCommOverrides({ source, dateWanted });
    res.status(200).json(response);
  } catch (e) {
    ConsoleLogger.error("comm-overrides fetch error:", e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

export default router;
