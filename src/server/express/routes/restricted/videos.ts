import express, { Request, Response } from "express";
import sortBy from "lodash/sortBy";
import { getORM } from "server/express/global";
import { AccessGrant_db } from "server/database/models/AccessGrant.model";
import { fetchForgedIoManifest } from "server/processing/io-api";
import { getApplicableMediaOverrides } from "server/processing/mediaOverrideResolver";
import { getUser } from "packages/getUser";
import { userIsInGrant } from "server/express/routes/db/accessGrants";
import ConsoleLogger from "utils/logging/consoleLogger";
import serverLogger from "utils/logging/serverLogger";

/**
 * Restricted-access video override endpoint.
 *
 * Returns a forged video manifest only when:
 *   1. A MediaOverride with type='video' exists for (source, dateWanted) AND has a non-null accessGrantId
 *   2. The caller's JWT-derived AUID is in the linked AccessGrant.auids list
 *
 * If no restricted override exists for that (source, date), responds 204 (caller should
 * fall back to the public socket-delivered video data). 401 for missing/invalid JWT.
 * If the user is identified but not in the grant, also responds 204 rather than 403 —
 * an ineligible user must not be able to distinguish "no restricted override exists"
 * from "one exists but you can't have it".
 *
 * NOTE: this endpoint MUST be reachable only via the launchpad-authed nginx path so
 * that JWT validation is enforced upstream as well as in the Express layer.
 */

const router = express.Router();

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const user = getUser(req);
  if (user instanceof Error) {
    res.status(401).json({ status: "error", message: "Unauthorized: authentication required" });
    return;
  }

  const source = (req.query.source as string | undefined)?.trim();
  const dateWanted = (req.query.dateWanted as string | undefined)?.trim();

  if (!source || !dateWanted) {
    res
      .status(400)
      .json({ status: "error", message: "source and dateWanted query params are required" });
    return;
  }
  if (!/^(19|20)\d\d-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/.test(dateWanted)) {
    res.status(400).json({ status: "error", message: "Invalid dateWanted (expected yyyy-mm-dd)" });
    return;
  }

  try {
    const em = getORM().em.fork();
    const overrides = await getApplicableMediaOverrides({
      source: source as Source,
      type: "video",
      requestedDate: dateWanted,
      visibility: "restricted",
    });
    const override = overrides[0];

    if (!override) {
      res.status(204).end();
      return;
    }
    if (typeof override.accessGrantId !== "number") {
      res.status(204).end();
      return;
    }

    const grant = await em.findOne(AccessGrant_db, { id: override.accessGrantId });
    if (!grant) {
      ConsoleLogger.warn(
        `Restricted video override ${override.id} references missing access grant ${override.accessGrantId}`
      );
      // 204, not 403/404: don't leak the existence of a restricted override to a
      // caller who isn't entitled to see it.
      res.status(204).end();
      return;
    }

    if (!userIsInGrant(user, grant)) {
      // Same as above: respond identically to the "no restricted override exists"
      // case so an ineligible user can't infer that restricted content exists.
      res.status(204).end();
      return;
    }

    const manifest = (await fetchForgedIoManifest({
      id: override.id,
      date: override.date,
      source: override.source,
      type: override.type,
      matchMode: override.matchMode,
      url: override.url,
    })) as VideoFile[];
    const videos = sortBy(manifest, "startDateTime");

    serverLogger.info(
      {
        logId: "restrictedOverrideAccess",
        overrideId: override.id,
        overrideType: override.type,
        grantId: grant.id,
        grantName: grant.name,
        source,
        dateWanted,
      },
      user
    );

    const response: FetchResponse<VideoFile[]> = {
      data: videos,
      fetchMetadata: {
        success: true,
        timestamp: new Date().toISOString(),
      },
      origin: "restricted-database",
    };
    res.status(200).json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    ConsoleLogger.error("restricted/videos error:", e);
    res
      .status(500)
      .json({ status: "error", message: `Error processing restricted video request: ${message}` });
  }
});

export default router;
