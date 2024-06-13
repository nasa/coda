import getLabsTranscripts from "server/processing/emss-labs/transcript";
import { Source } from "utils/enums";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

const router = express.Router();

const parseQuery = (query: Query) => {
  const { source, year, month, date, forceNew } = query;
  const queryObj = {
    source: source ? (source as string) : undefined,
    year: year ? (year as string) : undefined,
    month: month ? (month as string) : undefined,
    date: date ? (date as string) : undefined,
    forceNew: forceNew === "1",
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const transcript = await getLabsTranscripts(
      queryObj.source as Source,
      `${queryObj.year}-${queryObj.month.padStart(2, "0")}-${queryObj.date.padStart(2, "0")}`,
      queryObj.forceNew
    );
    res.status(200).json(transcript);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
