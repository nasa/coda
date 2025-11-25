import { globalValues } from "server/express/global";
import { Loaded } from "@mikro-orm/postgresql";
import { Ephemeris_db } from "server/database/models/_allModels";

/**
 * Get ISS TLE records around a specific date
 * Returns: 1 record from previous day (latest), all records from target day, 1 record from next day (earliest)
 */
export async function getEphemerisByDate(date: string): Promise<Ephemeris_db_type[]> {
  const em = globalValues.orm.em;
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
  const em = globalValues.orm.em;
  let inserted = 0;
  let skipped = 0;

  if (records.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  // Optimization: Fetch all existing epochs in one query instead of N+1
  const epochsToCheck = records.map((r) => new Date(r.epoch));

  const existingRecords = await em.find(
    Ephemeris_db,
    { epoch: { $in: epochsToCheck } },
    { fields: ["epoch"] }
  );

  const existingEpochs = new Set(existingRecords.map((r) => r.epoch.getTime()));

  for (const record of records) {
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
  const em = globalValues.orm.em;
  const count = await em.count(Ephemeris_db);
  const latestRecords = await em.find(Ephemeris_db, {}, { orderBy: { epoch: "DESC" }, limit: 1 });

  // Get counts per year
  const yearCountsResult = await em.getConnection().execute(
    `SELECT EXTRACT(YEAR FROM epoch)::int as year, COUNT(*) as count 
     FROM ephemeris_db 
     GROUP BY EXTRACT(YEAR FROM epoch) 
     ORDER BY year ASC`
  );
  const yearCounts: Array<{ year: number; count: string }> =
    (yearCountsResult as any).rows || yearCountsResult;

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
