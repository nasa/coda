import getSgAudio from "server/emss-labs/sgAudio";
import { Source, Collection } from "utils/enums";
import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";

const router = express.Router();

const parseQuery = (query: Query) => {
  const { source, year, month, date, collection, forceNew } = query;
  const queryObj = {
    source: source ? (source as string) : undefined,
    year: year ? (year as string) : undefined,
    month: month ? (month as string) : undefined,
    date: date ? (date as string) : undefined,
    collection: collection ? (collection as string) : undefined,
    forceNew: forceNew === "1",
  };
  return queryObj;
};

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);
  try {
    const response = await getSgAudio(
      queryObj.source as Source,
      `${queryObj.year}-${queryObj.month.padStart(2, "0")}-${queryObj.date.padStart(2, "0")}`,
      Collection[queryObj.collection],
      queryObj.forceNew
    );
    res.status(200).json(response);
    return;
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.toString() });
    return;
  }
});

export default router;
