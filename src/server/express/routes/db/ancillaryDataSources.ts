import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { getEM } from "utils/mikro";
import { Loaded } from "@mikro-orm/core";
import { AncillaryDataSource_db } from "server/database/models/_allModels";

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
      const wrappedResponse: WrappedResponse<AncillaryDataSource[]> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
          expiration: null,
          error: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: records,
      };
      res.status(200).json(wrappedResponse);
    } else {
      const records: AncillaryDataSourceList[] = await getAncillaryDataSourceList();
      const wrappedResponse: WrappedResponse<AncillaryDataSourceList[]> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
          expiration: null,
          error: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: records,
      };
      res.status(200).json(wrappedResponse);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// get by id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  try {
    const em = getEM();
    const ancillaryDataSource: AncillaryDataSource = await em.findOne(AncillaryDataSource_db, {
      id: Number(id),
    });
    if (ancillaryDataSource) {
      const wrappedResponse: WrappedResponse<AncillaryDataSource> = {
        responseMetadata: {
          retrieverStatus: "complete",
          cachedTimestamp: null,
          expiration: null,
          error: null,
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: ancillaryDataSource,
      };
      res.status(200).json(wrappedResponse);
    } else {
      const wrappedResponse: WrappedResponse<AncillaryDataSource> = {
        responseMetadata: {
          retrieverStatus: "error",
          cachedTimestamp: null,
          expiration: null,
          error: "ancillary data source not found",
          retrieverErrorCount: 0,
          lastErrorTimestamp: null,
        },
        source: "database",
        data: null,
      };
      res.status(404).json(wrappedResponse);
    }
  } catch (e) {
    console.error(e);
    const wrappedResponse: WrappedResponse<AncillaryDataSource> = {
      responseMetadata: {
        retrieverStatus: "error",
        cachedTimestamp: null,
        expiration: null,
        error: e.toString(),
        retrieverErrorCount: 1,
        lastErrorTimestamp: null,
      },
      source: "database",
      data: null,
    };
    res.status(500).json(wrappedResponse);
  }
});

// create via post
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { id, date, source, type, url } = req.body as AncillaryDataUpsertRequest;

  try {
    const em = getEM();
    if (id) {
      const ancillaryDataSource = await em.findOne(AncillaryDataSource_db, { id: Number(id) });
      if (ancillaryDataSource) {
        ancillaryDataSource.date = date;
        ancillaryDataSource.source = source;
        ancillaryDataSource.type = type;
        ancillaryDataSource.url = url;
        await em.persistAndFlush(ancillaryDataSource);
        res.status(200).json({
          status: "success",
          message: "ancillary data source updated",
          data: ancillaryDataSource,
        });
      } else {
        res.status(404).json({ status: "error", message: "ancillary data source not found" });
      }
    } else {
      const ancillaryDataSource: AncillaryDataSource = em.create(AncillaryDataSource_db, {
        id,
        date,
        source,
        type,
        url,
      });
      await em.persistAndFlush(ancillaryDataSource);
      res.status(201).json({
        status: "success",
        message: "ancillary data source inserted",
        data: ancillaryDataSource,
      });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "error", message: `Error processing the POST request ${e}` });
  }
});

// delete
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  try {
    const em = getEM();
    const ancillaryDataSource: AncillaryDataSource = await em.findOne(AncillaryDataSource_db, {
      id: Number(id),
    });
    if (ancillaryDataSource) {
      await em.removeAndFlush(ancillaryDataSource);
      res.status(200).json({ status: "success", message: "ancillary data source deleted" });
    } else {
      res.status(404).json({ status: "error", message: "ancillary data source not found" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;

export async function getAncillaryDataSourcesByDate(date: string): Promise<AncillaryDataSource[]> {
  const em = getEM();

  let ancillaryDataSource_db: Loaded<AncillaryDataSource_db, never>[];
  ancillaryDataSource_db = await em.find(
    AncillaryDataSource_db,
    { date: date },
    { orderBy: { source: "ASC" } }
  );
  if (ancillaryDataSource_db) {
    const ancillaryDataSourceData: AncillaryDataSource[] = ancillaryDataSource_db.map(
      (ancillaryDataSourceRecord) => {
        const ancillaryDataSource = ancillaryDataSourceRecord;
        return ancillaryDataSource;
      }
    );
    return ancillaryDataSourceData;
  } else {
    return [];
  }
}

export async function getAncillaryDataSourceList(): Promise<AncillaryDataSourceList[]> {
  const em = getEM();

  const ancillaryDataSource_db = await em.find(
    AncillaryDataSource_db,
    {},
    { orderBy: { date: "ASC", source: "ASC" }, fields: ["id", "date", "source", "type", "url"] }
  );
  if (ancillaryDataSource_db) {
    return ancillaryDataSource_db;
  } else {
    return [];
  }
}
