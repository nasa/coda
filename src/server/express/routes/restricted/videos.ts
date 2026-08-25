import express, { Request, Response } from "express";
import sortBy from "lodash/sortBy";
import { getORM } from "server/express/global";
import { AccessGrant_db } from "server/database/models/AccessGrant.model";
import { fetchForgedIoManifest } from "server/processing/io-api";
import { getApplicableMediaOverrides } from "server/processing/mediaOverrideResolver";
import { getUser } from "packages/getUser";
import { userIsInGrant } from "server/express/routes/db/accessGrants";
import { isCanonicalDate } from "server/processing/mediaOverrideResolver";
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
  if (!isCanonicalDate(dateWanted)) {
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
    if (overrides.length === 0) {
      res.status(204).end();
      return;
    }
    const grantIds = Array.from(
      new Set(
        overrides
          .map((override) => override.accessGrantId)
          .filter((id): id is number => typeof id === "number")
      )
    );
    const grants = await em.find(AccessGrant_db, { id: { $in: grantIds } });
    const grantsById = new Map(grants.map((grant) => [grant.id, grant]));
    const authorizedOverrides = overrides.filter((override) => {
      if (typeof override.accessGrantId !== "number") return false;
      const grant = grantsById.get(override.accessGrantId);
      if (!grant) {
        ConsoleLogger.warn(
          `Restricted video override ${override.id} references missing access grant ${override.accessGrantId}`
        );
        return false;
      }
      return userIsInGrant(user, grant);
    });

    if (authorizedOverrides.length === 0) {
      // Respond identically to the "no restricted override exists" case so an
      // ineligible user cannot infer that restricted content exists.
      res.status(204).end();
      return;
    }

    const manifests = await Promise.all(
      authorizedOverrides.map((override) => fetchForgedIoManifest(override))
    );
    const videos = sortBy(manifests.flat() as VideoFile[], "startDateTime");

    for (const override of authorizedOverrides) {
      const grant = grantsById.get(override.accessGrantId as number);
      if (!grant) continue;
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
    }

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
