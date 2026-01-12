import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import {
  deleteAncillaryDataSourceById,
  getAncillaryDataSourceById,
  getAncillaryDataSourceList,
  getAncillaryDataSourcesByDate,
  upsertAncillaryDataSource,
} from "server/processing/ancillaryDataSources";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * Get Ancillary Data Source URLs from CODA DB for a given date
 */

const router = express.Router();

const parseQuery = (query: Query): AncillaryDataQueryParams => {
  const { dateWanted } = query;
  const queryObj: AncillaryDataQueryParams = {
    dateWanted: dateWanted as string,
  };
  return queryObj;
};

// get by date or get list if no date provided
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);

  try {
    if (queryObj.dateWanted) {
      if (
        !queryObj.dateWanted.match(
          /^(19|20)\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])$/
        )
      ) {
        res.status(400).json({ status: "error", message: "Invalid date format" });
        return;
      }
      const records: AncillaryDataSource[] = await getAncillaryDataSourcesByDate(
        queryObj.dateWanted
      );
      res.status(200).json(records);
    } else {
      const records: AncillaryDataSourceList[] = await getAncillaryDataSourceList();
      res.status(200).json(records);
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// get by id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  try {
    const ancillaryDataSource = await getAncillaryDataSourceById(Number(id));
    if (ancillaryDataSource) {
      res.status(200).json(ancillaryDataSource);
    } else {
      res.status(404).json({ status: "error", message: "ancillary data source not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// create via post
router.post("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const { id, date, source, type, url } = req.body as AncillaryDataUpsertRequest;

  try {
    const result = await upsertAncillaryDataSource({ id, date, source, type, url });
    if (!result) {
      res.status(404).json({ status: "error", message: "ancillary data source not found" });
      return;
    }

    const { record, isNew } = result;
    const statusCode = isNew ? 201 : 200;
    const message = isNew ? "ancillary data source inserted" : "ancillary data source updated";
    res.status(statusCode).json({ status: "success", message, data: record });
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the POST request ${e}` });
  }
});

// delete
router.delete("/:id", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  try {
    const deleted = await deleteAncillaryDataSourceById(Number(id));
    if (deleted) {
      res.status(200).json({ status: "success", message: "ancillary data source deleted" });
    } else {
      res.status(404).json({ status: "error", message: "ancillary data source not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;
