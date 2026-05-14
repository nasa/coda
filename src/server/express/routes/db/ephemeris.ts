import express, { Request, Response } from "express";
import { Query } from "express-serve-static-core";
import {
  getEphemerisByDate,
  upsertEphemerisRecords,
  getStats,
  getEphemerisRecordsSince,
  RECENT_RECORDS_MAX,
} from "server/processing/ephemeris";
import { backfillFromSpaceTrack, scanForGaps } from "server/processing/ephemeris-backfill";
import { triggerSpacetrackUpdate } from "server/express/spacetrackScheduler";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import { requireEmssToken } from "server/express/middleware/requireEmssToken";
import { getUser } from "packages/getUser";
import { globalValues } from "server/express/global";
import ConsoleLogger from "utils/logging/consoleLogger";
import { Ephemeris_db } from "server/database/models/ephemera.model";

const DEFAULT_SINCE_DAYS = 30;

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

    if (!origin || !["spacetrack", "seed"].includes(origin)) {
      res.status(400).json({ status: "error", message: "origin must be 'spacetrack' or 'seed'" });
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

// Server-to-server sync endpoint: returns records with epoch > `since`.
// Called by non-prod CODA instances to mirror the prod ephemeris DB without
// hitting Space-Track. Auth via shared EMSS_TOKEN (x-api-key header).
router.get("/recent", requireEmssToken, async (req: Request, res: Response): Promise<void> => {
  try {
    let since: Date;
    const sinceParam = req.query.since;
    if (typeof sinceParam === "string" && sinceParam.length > 0) {
      since = new Date(sinceParam);
      if (isNaN(since.getTime())) {
        res
          .status(400)
          .json({ status: "error", message: "Invalid `since` parameter (must be ISO 8601)" });
        return;
      }
    } else {
      // No `since` supplied — new instance with empty DB. Default to 30 days.
      since = new Date();
      since.setDate(since.getDate() - DEFAULT_SINCE_DAYS);
    }

    const records = await getEphemerisRecordsSince(since);
    const payload: EphemerisEntry[] = records.map((r) => ({
      epoch: r.epoch.toISOString(),
      tle_line1: r.tle_line1,
      tle_line2: r.tle_line2,
    }));

    if (payload.length === RECENT_RECORDS_MAX) {
      ConsoleLogger.warn(
        `/ephemeris/recent hit row cap (${RECENT_RECORDS_MAX}); caller since=${since.toISOString()} should retry with a newer \`since\` date (e.g. the latest epoch received)`
      );
    }

    res.status(200).json(payload);
  } catch (e) {
    ConsoleLogger.error(e);
    res
      .status(500)
      .json({ status: "error", message: `Error fetching recent ephemeris records ${e}` });
  }
});

// Get database statistics
router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getStats();
    // backfillEnabled mirrors the prod-only check on POST /backfill: this
    // instance is allowed to call Space-Track directly only when it is NOT
    // configured to sync from another CODA instance.
    const backfillEnabled = !process.env.EPHEMERIS_SYNC_FROM_URL;
    res.status(200).json({ ...stats, backfillEnabled });
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error fetching stats ${e}` });
  }
});

// Lightweight gap-scan endpoint — reads the DB but never calls Space-Track.
// The admin UI polls this to show whether a backfill is needed.
router.get(
  "/backfill/status",
  requireSuperuser,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await scanForGaps();
      res.status(200).json(result);
    } catch (e) {
      ConsoleLogger.error(e);
      res.status(500).json({ status: "error", message: `Error scanning for gaps ${e}` });
    }
  }
);

// Backfill missing TLEs from Space-Track's `gp_history` class.
//
// PROD ONLY: non-prod instances mirror prod via /api/v1/db/ephemeris/recent
// (see ephemeris-sync.ts) and must not hit Space-Track directly. The check
// uses the same heuristic as the scheduler: an empty EPHEMERIS_SYNC_FROM_URL
// means "this instance is the source of truth" (i.e. prod).
router.post("/backfill", requireSuperuser, async (_req: Request, res: Response): Promise<void> => {
  if (process.env.EPHEMERIS_SYNC_FROM_URL) {
    res.status(403).json({
      status: "error",
      message:
        "Backfill is disabled on this instance because EPHEMERIS_SYNC_FROM_URL is set. " +
        "Non-prod instances mirror TLE data from prod via the scheduler — there is nothing to backfill here.",
    });
    return;
  }

  try {
    // Streaming ndjson response so the admin UI can show progress live.
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const onProgress = (message: string) => {
      res.write(JSON.stringify({ progress: message }) + "\n");
    };

    const result = await backfillFromSpaceTrack(onProgress);

    res.write(
      JSON.stringify({
        complete: true,
        message: result.success
          ? `Backfill complete. Fetched ${result.recordsFetched ?? 0} records, ` +
            `inserted ${result.recordsInserted ?? 0} new, ` +
            `skipped ${result.recordsSkipped ?? 0} duplicates.`
          : `Backfill failed: ${result.errorMessage ?? "unknown error"}`,
        data: result,
      }) + "\n"
    );
    res.end();
  } catch (e) {
    ConsoleLogger.error(e);
    res.write(
      JSON.stringify({ error: true, message: `Error processing the backfill request ${e}` }) + "\n"
    );
    res.end();
  }
});

// Trigger manual Space-Track update (resets the interval)
router.post(
  "/spacetrack/trigger",
  requireSuperuser,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getUser(req);
      const username = user instanceof Error ? "unknown" : user.email || user.auid || "unknown";
      await triggerSpacetrackUpdate(username);

      res.status(200).json({
        status: "success",
        message: "Space-Track update triggered successfully",
        data: { ...globalValues.spacetrackTrackerData },
      });
    } catch (e) {
      ConsoleLogger.error(e);
      res
        .status(500)
        .json({ status: "error", message: `Error triggering Space-Track update ${e}` });
    }
  }
);

export default router;
