import { getORM } from "server/express/global";
import { Loaded } from "@mikro-orm/postgresql";
import { Ephemeris_db } from "server/database/models/ephemera.model";

/**
 * Get ISS TLE records around a specific date
 * Returns: 1 record from previous day (latest), all records from target day, 1 record from next day (earliest)
 */
export async function getEphemerisByDate(date: string): Promise<Ephemeris_db[]> {
  const em = getORM().em.fork();
  const targetDate = new Date(date);

  // Calculate start and end of the target day
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // Get latest record from previous day
  const before: Loaded<Ephemeris_db, never>[] = await em.find(
    Ephemeris_db,
    { epoch: { $lt: startOfDay } },
    { orderBy: { epoch: "DESC" }, limit: 1 }
  );

  // Get all records from the target day
  const targetDay: Loaded<Ephemeris_db, never>[] = await em.find(
    Ephemeris_db,
    { epoch: { $gte: startOfDay, $lte: endOfDay } },
    { orderBy: { epoch: "ASC" } }
  );

  // Get earliest record from next day
  const after: Loaded<Ephemeris_db, never>[] = await em.find(
    Ephemeris_db,
    { epoch: { $gt: endOfDay } },
    { orderBy: { epoch: "ASC" }, limit: 1 }
  );

  // Combine all records
  return [...before, ...targetDay, ...after];
}

/**
 * Upsert multiple ISS TLE records
 * Uses epoch as the unique key - will skip duplicates
 */
export async function upsertEphemerisRecords({
  records,
  origin,
}: EphemerisUpsertRequest): Promise<{ inserted: number; skipped: number }> {
  const em = getORM().em.fork();
  let inserted = 0;
  let skipped = 0;

  if (records.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  // Deduplicate records within the batch by epoch (keep first occurrence)
  const seenEpochs = new Set<number>();
  const uniqueRecords = records.filter((r) => {
    const epochTime = new Date(r.epoch).getTime();
    if (seenEpochs.has(epochTime)) {
      return false;
    }
    seenEpochs.add(epochTime);
    return true;
  });

  const batchDuplicates = records.length - uniqueRecords.length;
  skipped += batchDuplicates;

  // Optimization: Fetch all existing epochs in one query instead of N+1
  const epochsToCheck = uniqueRecords.map((r) => new Date(r.epoch));

  const existingRecords = await em.find(
    Ephemeris_db,
    { epoch: { $in: epochsToCheck } },
    { fields: ["epoch"] }
  );

  const existingEpochs = new Set(existingRecords.map((r) => r.epoch.getTime()));

  for (const record of uniqueRecords) {
    const epoch = new Date(record.epoch);

    // Check if record already exists
    if (existingEpochs.has(epoch.getTime())) {
      skipped++;
      continue;
    }

    // Create new record
    em.create(Ephemeris_db, {
      epoch,
      tle_line1: record.tle_line1,
      tle_line2: record.tle_line2,
      origin,
      createdAt: new Date(),
    });

    inserted++;
  }

  if (inserted > 0) {
    await em.flush();
  }

  return { inserted, skipped };
}

/**
 * Get database statistics for ephemeris records
 */
export async function getStats(): Promise<{
  count: number;
  latestEpoch: Date | null;
  yearCounts: Array<{ year: number; count: number }>;
}> {
  const em = getORM().em.fork();
  const count = await em.count(Ephemeris_db);
  const latestRecords = await em.find(Ephemeris_db, {}, { orderBy: { epoch: "DESC" }, limit: 1 });

  // Get counts per year using raw SQL for aggregation
  const connection = em.getConnection();
  const yearCountsResult = await connection.execute(
    `SELECT EXTRACT(YEAR FROM epoch)::int as year, COUNT(*) as count
     FROM ephemeris_db
     GROUP BY EXTRACT(YEAR FROM epoch)
     ORDER BY year ASC`
  );
  const yearCounts: Array<{ year: number; count: string }> =
    (yearCountsResult as { rows?: Array<{ year: number; count: string }> }).rows ??
    (yearCountsResult as Array<{ year: number; count: string }>);

  return {
    count,
    latestEpoch: latestRecords[0]?.epoch || null,
    yearCounts: yearCounts.map((yc) => ({
      year: yc.year,
      count: parseInt(yc.count, 10),
    })),
  };
}

/**
 * Get the created_at timestamp of the most recently created ephemeris record
 * Used to determine if we should fetch from Space-Track on startup
 */
export async function getLatestRecordCreatedAt(): Promise<Date | null> {
  const em = getORM().em.fork();
  const latestRecords = await em.find(
    Ephemeris_db,
    {},
    { orderBy: { createdAt: "DESC" }, limit: 1 }
  );
  return latestRecords[0]?.createdAt || null;
}

/** Sanity cap on /recent payload to protect against a malformed/very-old `since`. */
export const RECENT_RECORDS_MAX = 100000;

/**
 * Get all TLE records with epoch strictly greater than `since`, ordered ascending.
 */
export async function getEphemerisRecordsSince(since: Date): Promise<Ephemeris_db[]> {
  const em = getORM().em.fork();
  return em.find(
    Ephemeris_db,
    { epoch: { $gt: since } },
    { orderBy: { epoch: "ASC" }, limit: RECENT_RECORDS_MAX }
  );
}

/**
 * Get ISS TLE records for a specific date from the database
 * Returns TLE records around the requested date (used by data scheduler)
 */
export default async function getEphemera({
  dateWanted,
}: {
  dateWanted: string;
}): Promise<FetchResponse<EphemerisEntry[]>> {
  try {
    const records = await getEphemerisByDate(dateWanted);
    const timestamp = new Date().toISOString();

    const ephemerisEntries: EphemerisEntry[] = records.map((record) => ({
      epoch: record.epoch.toISOString(),
      tle_line1: record.tle_line1,
      tle_line2: record.tle_line2,
    }));

    return {
      data: ephemerisEntries,
      fetchMetadata: {
        success: true,
        error: undefined,
        timestamp,
      },
    };
  } catch (error) {
    const timestamp = new Date().toISOString();
    return {
      data: [],
      fetchMetadata: {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error fetching ephemeris data",
        timestamp,
      },
    };
  }
}
