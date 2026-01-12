import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import { getEphemerisByDate, upsertEphemerisRecords, getStats } from "server/processing/ephemeris";
import { seedMissingData } from "server/processing/ephemeris-seed";
import { triggerCelestrakUpdate } from "server/express/celestrakScheduler";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import { getUser } from "packages/getUser";
import { globalValues } from "server/express/global";
import ConsoleLogger from "utils/logging/consoleLogger";
import { Ephemeris_db } from "server/database/models/ephemera.model";

/**
 * Get ISS TLE records from CODA DB
 */

const router = express.Router();

const parseQuery = (query: Query): EphemerisQueryParams => {
  const { dateWanted } = query;
  const queryObj: EphemerisQueryParams = {
    dateWanted: dateWanted as string,
  };
  return queryObj;
};

// get records around a date (3 before, 3 after)
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const queryObj = parseQuery(req.query);

  try {
    if (!queryObj.dateWanted) {
      res.status(400).json({ status: "error", message: "dateWanted parameter is required" });
      return;
    }

    // Validate ISO 8601 date format
    const dateTest = new Date(queryObj.dateWanted);
    if (isNaN(dateTest.getTime())) {
      res.status(400).json({ status: "error", message: "Invalid date format" });
      return;
    }

    const records: Ephemeris_db[] = await getEphemerisByDate(queryObj.dateWanted);
    res.status(200).json(records);
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// create via post (bulk insert)
router.post("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const { records, origin } = req.body as EphemerisUpsertRequest;

  try {
    if (!records || !Array.isArray(records) || records.length === 0) {
      res.status(400).json({ status: "error", message: "records array is required" });
      return;
    }

    if (!origin || !["celestrak", "seed"].includes(origin)) {
      res.status(400).json({ status: "error", message: "origin must be 'celestrak' or 'seed'" });
      return;
    }

    // Validate record structure
    for (const record of records) {
      if (!record.epoch || !record.tle_line1 || !record.tle_line2) {
        res.status(400).json({
          status: "error",
          message: "Each record must have epoch, tle_line1, and tle_line2",
        });
        return;
      }

      // Validate epoch is a valid date
      const dateTest = new Date(record.epoch);
      if (isNaN(dateTest.getTime())) {
        res.status(400).json({ status: "error", message: `Invalid epoch format: ${record.epoch}` });
        return;
      }
    }

    const result = await upsertEphemerisRecords({ records, origin });

    res.status(201).json({
      status: "success",
      message: `Inserted ${result.inserted} records, skipped ${result.skipped} duplicates`,
      data: result,
    });
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the POST request ${e}` });
  }
});

// Get database statistics
router.get("/stats", async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getStats();
    res.status(200).json(stats);
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error fetching stats ${e}` });
  }
});

// Seed database from remote source
router.post("/seed", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  try {
    // Set headers for streaming response (newline-delimited JSON)
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Progress callback to stream updates
    const onProgress = (message: string) => {
      res.write(JSON.stringify({ progress: message }) + "\n");
    };

    const result = await seedMissingData(onProgress);

    // Send final result
    res.write(
      JSON.stringify({
        complete: true,
        message: `Processed ${result.monthsProcessed} months. Inserted ${result.totalInserted} records, skipped ${result.totalSkipped} duplicates`,
        data: result,
      }) + "\n"
    );
    res.end();
  } catch (e) {
    ConsoleLogger.error(e);
    res.write(
      JSON.stringify({ error: true, message: `Error processing the seed request ${e}` }) + "\n"
    );
    res.end();
  }
});

// Trigger manual Celestrak update (resets the interval)
router.post(
  "/celestrak/trigger",
  requireSuperuser,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getUser(req);
      const username = user instanceof Error ? "unknown" : user.email || user.auid || "unknown";
      await triggerCelestrakUpdate(username);

      res.status(200).json({
        status: "success",
        message: "Celestrak update triggered successfully",
        data: { ...globalValues.celestrakTrackerData },
      });
    } catch (e) {
      ConsoleLogger.error(e);
      res.status(500).json({ status: "error", message: `Error triggering Celestrak update ${e}` });
    }
  }
);

export default router;
