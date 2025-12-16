/**
 * ISS TLE Database Seeding Script
 * Fetches historical TLE data from https://data2.issinrealtime.org/ephemeris
 * and populates the database with accurate epoch calculations from TLE line1
 */
import fetchWithTimeout from "utils/fetch-with-timeout";
import { getEpochTimestamp } from "tle.js";
import ConsoleLogger from "utils/logging/consoleLogger";
import { upsertEphemerisRecords } from "./ephemeris";

/**
 * Parse precise epoch from TLE line1
 * TLE epoch is more accurate than the JSON epoch field - recalculate from line1
 */
function calculateEpochFromTLE(line1: string, line2: string): Date | null {
  try {
    // Create a minimal 3-line TLE format (name can be anything)
    const tle = `ISS (ZARYA)\n${line1}\n${line2}`;
    const epochMs = getEpochTimestamp(tle);

    if (!epochMs || isNaN(epochMs) || !isFinite(epochMs)) {
      ConsoleLogger.error(`Invalid epoch from TLE: ${epochMs}`);
      return null;
    }

    const epochDate = new Date(epochMs);
    if (isNaN(epochDate.getTime())) {
      ConsoleLogger.error(`Unable to create valid Date from epoch: ${epochMs}`);
      return null;
    }

    return epochDate;
  } catch (e) {
    ConsoleLogger.error(`Error calculating epoch from TLE: ${e}`);
    return null;
  }
}

/**
 * Fetch a single month's TLE data from the remote source
 */
async function fetchMonthData(year: number, month: number): Promise<EphemerisEntry[]> {
  const monthStr = month.toString().padStart(2, "0");
  // alternate source for ephemeris data
  //const url = `https://data2.issinrealtime.org/ephemera/${year}/${year}-${monthStr}.json`;
  const url = `https://data.issinrealtime.org/ISSiRT_assets/ephemera/${year}/${year}-${monthStr}.json`;

  try {
    ConsoleLogger.debug(`Fetching ${url}...`);
    const res = await fetchWithTimeout(url, { method: "GET" });

    if (!res.ok) {
      ConsoleLogger.warn(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      return [];
    }

    const data: EphemerisEntry[] = await res.json();
    return data;
  } catch (e) {
    ConsoleLogger.error(`Error fetching ${url}: ${e}`);
    return [];
  }
}

/**
 * Process and insert records for a specific month
 */
async function seedMonth(
  year: number,
  month: number
): Promise<{ inserted: number; skipped: number }> {
  const records = await fetchMonthData(year, month);

  if (records.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  // Calculate precise epochs from TLE data
  const processedRecords = records
    .map((record) => {
      const epoch = calculateEpochFromTLE(record.tle_line1, record.tle_line2);
      if (!epoch) {
        ConsoleLogger.warn(`Skipping record with invalid epoch calculation`);
        return null;
      }

      return {
        epoch: epoch.toISOString(),
        tle_line1: record.tle_line1,
        tle_line2: record.tle_line2,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (processedRecords.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  // Upsert to database
  const result = await upsertEphemerisRecords({
    records: processedRecords,
    origin: "seed",
  });

  ConsoleLogger.info(
    `${year}-${month.toString().padStart(2, "0")}: Inserted ${result.inserted}, Skipped ${result.skipped}`
  );

  return result;
}

/**
 * Seed the database with missing ephemeris data using iss in real time json source
 * Fetches all months from October 2000 to present and lets duplicate detection handle overlaps
 */
export async function seedMissingData(onProgress?: (message: string) => void): Promise<{
  totalInserted: number;
  totalSkipped: number;
  monthsProcessed: number;
}> {
  let totalInserted = 0;
  let totalSkipped = 0;
  let monthsProcessed = 0;

  ConsoleLogger.info("Seeding ephemeris data from October 2000 to present...");

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  // Always start from October 2000
  const startYear = 2000;
  const startMonth = 10;

  ConsoleLogger.info(
    `Fetching from ${startYear}-${startMonth.toString().padStart(2, "0")} to ${currentYear}-${currentMonth.toString().padStart(2, "0")}`
  );

  // Calculate total months to process
  let totalMonths = 0;
  for (let year = startYear; year <= currentYear; year++) {
    const monthStart = year === startYear ? startMonth : 1;
    const monthEnd = year === currentYear ? currentMonth : 12;
    totalMonths += monthEnd - monthStart + 1;
  }

  let processedMonths = 0;

  // Fetch each month from start to current
  for (let year = startYear; year <= currentYear; year++) {
    const monthStart = year === startYear ? startMonth : 1;
    const monthEnd = year === currentYear ? currentMonth : 12;

    for (let month = monthStart; month <= monthEnd; month++) {
      processedMonths++;
      const monthStr = `${year}-${month.toString().padStart(2, "0")}`;

      if (onProgress) {
        onProgress(`Processing ${monthStr} (${processedMonths}/${totalMonths})...`);
      }

      const result = await seedMonth(year, month);
      totalInserted += result.inserted;
      totalSkipped += result.skipped;

      if (result.inserted > 0 || result.skipped > 0) {
        monthsProcessed++;
      }

      if (onProgress && (result.inserted > 0 || result.skipped > 0)) {
        onProgress(
          `${monthStr}: +${result.inserted} new, ${result.skipped} existing (${processedMonths}/${totalMonths})`
        );
      }

      // Add a small delay to avoid hammering the server
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  ConsoleLogger.info(
    `Seeding complete! Processed ${monthsProcessed} months. Inserted: ${totalInserted}, Skipped: ${totalSkipped}`
  );

  return { totalInserted, totalSkipped, monthsProcessed };
}
