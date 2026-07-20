import express, { Request, Response } from "express";
import { getORM } from "server/express/global";
import { AccessGrant_db } from "server/database/models/AccessGrant.model";
import { MediaOverride_db } from "server/database/models/mediaOverride.model";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import { isSuperuser } from "utils/user";
import ConsoleLogger from "utils/logging/consoleLogger";

const router = express.Router();

const sanitizeAuids = (raw: unknown): string[] | null => {
  if (!Array.isArray(raw)) return null;
  const cleaned: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    if (trimmed.length === 0) continue;
    cleaned.push(trimmed.toLowerCase());
  }
  return cleaned;
};

// list
router.get("/", requireSuperuser, async (_req: Request, res: Response): Promise<void> => {
  try {
    const records = await getAccessGrantsList();
    res.status(200).json(records);
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// get full record by id
router.get("/:id", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const em = getORM().em;

  try {
    const record = await em.findOne(AccessGrant_db, { id: Number(id) });
    if (record) {
      res.status(200).json(record);
    } else {
      res.status(404).json({ status: "error", message: "access grant not found" });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the GET request ${e}` });
  }
});

// create or update
router.post("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const { id, name, auids, notes } = req.body as AccessGrantUpsertRequest;

  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ status: "error", message: "name is required" });
    return;
  }
  const cleanedAuids = sanitizeAuids(auids);
  if (cleanedAuids === null) {
    res.status(400).json({ status: "error", message: "auids must be an array of strings" });
    return;
  }

  const em = getORM().em;

  try {
    if (id) {
      const record = await em.findOne(AccessGrant_db, { id: Number(id) });
      if (record) {
        record.name = name.trim();
        record.auids = cleanedAuids;
        record.notes = notes;
        await em.persist(record).flush();
        res.status(200).json({ status: "success", message: "access grant updated", data: record });
      } else {
        res.status(404).json({ status: "error", message: "access grant not found" });
      }
    } else {
      const record = em.create(AccessGrant_db, {
        name: name.trim(),
        auids: cleanedAuids,
        notes,
      });
      await em.persist(record).flush();
      res.status(201).json({ status: "success", message: "access grant inserted", data: record });
    }
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the POST request ${e}` });
  }
});

// delete
router.delete("/:id", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const em = getORM().em;

  try {
    const record = await em.findOne(AccessGrant_db, { id: Number(id) });
    if (!record) {
      res.status(404).json({ status: "error", message: "access grant not found" });
      return;
    }
    // Refuse to delete if any MediaOverride still references this grant
    const refCount = await em.count(MediaOverride_db, { accessGrantId: Number(id) });
    if (refCount > 0) {
      res.status(409).json({
        status: "error",
        message: `Cannot delete: ${refCount} media override(s) still reference this access grant`,
      });
      return;
    }
    await em.remove(record).flush();
    res.status(200).json({ status: "success", message: "access grant deleted" });
  } catch (e) {
    ConsoleLogger.error(e);
    res.status(500).json({ status: "error", message: `Error processing the DELETE request ${e}` });
  }
});

export default router;

/**
 * Returns lightweight summaries of all access grants (no AUID list).
 * Used by the admin list page.
 */
export async function getAccessGrantsList(): Promise<AccessGrantListItem[]> {
  const em = getORM().em.fork();
  const records = await em.find(AccessGrant_db, {}, { orderBy: { name: "ASC" } });
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    auidCount: Array.isArray(r.auids) ? r.auids.length : 0,
    notes: r.notes,
  }));
}

/**
 * Find every restricted MediaOverride for (source, date) for which the given user
 * is in the linked AccessGrant (or is a superuser). Used to populate VisitorData.restrictedAccesses.
 */
export async function findRestrictedAccessesForUser(
  user: EmssUser | undefined,
  source: Source,
  date: string
): Promise<VisitorRestrictedAccess[]> {
  const auid = user?.auid;
  if (!auid) return [];
  const userIsSuperuser = isSuperuser(user);
  const em = getORM().em.fork();
  const overrides = await em.find(MediaOverride_db, {
    source,
    date,
    accessGrantId: { $ne: null },
  });
  if (overrides.length === 0) return [];

  const grantIds = Array.from(
    new Set(overrides.map((o) => o.accessGrantId).filter((v): v is number => typeof v === "number"))
  );
  const grants = await em.find(AccessGrant_db, { id: { $in: grantIds } });
  const grantsById = new Map(grants.map((g) => [g.id, g]));

  const results: VisitorRestrictedAccess[] = [];
  for (const o of overrides) {
    if (typeof o.accessGrantId !== "number") continue;
    const grant = grantsById.get(o.accessGrantId);
    if (!grant) continue;
    if (
      !userIsSuperuser &&
      (!Array.isArray(grant.auids) || !grant.auids.includes(auid.toLowerCase()))
    )
      continue;
    results.push({
      overrideId: o.id,
      overrideType: o.type,
      grantId: grant.id,
      grantName: grant.name,
    });
  }
  return results;
}
