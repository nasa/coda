/**
 * MTX video max age in days - loaded from environment variable.
 * Server-side: process.env.VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS
 * Client-side: import.meta.env.VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS
 */
export const getMtxVideoMaxAgeDays = (): number => {
  // Use process.env for server-side, import.meta.env for client-side
  const envValue =
    typeof process !== "undefined" && process.env?.VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS
      ? process.env.VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS
      : (import.meta.env.VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS as string | undefined);

  if (!envValue) {
    throw new Error("VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS is not defined");
  }

  const parsed = parseInt(envValue, 10);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(
      `VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS must be a non-negative integer, got: ${envValue}`
    );
  }

  return parsed;
};

/**
 * Define which data types are available for each source.
 * This mapping is used by both client and server code to ensure consistency.
 */
export const SOURCE_DATA_TYPE_MAP: Record<Source, StoreDataType[]> = {
  ISS: ["daynight", "ephemeris", "videos", "mtxvideo", "photos", "wikiEvas", "talkybot"],
  TEST_EVENTS: ["videos", "mtxvideo", "photos", "wikiTestEvents", "talkybot", "graph", "gpstracks"],
  NBL: ["videos", "photos", "wikiTestEvents", "mtxvideo", "graph"],
  ARTEMIS: ["videos", "photos", "wikiTestEvents", "mtxvideo"],
};

/**
 * Check if a data type is valid for a given source
 */
export const isDataTypeValidForSource = (source: Source, dataType: StoreDataType): boolean => {
  return SOURCE_DATA_TYPE_MAP[source]?.includes(dataType) ?? false;
};

/**
 * Check if a date is within the valid range for mtxvideo data.
 * MTX video is only available for dates within the last N days.
 * @param dateWanted - The date to check (ISO string format YYYY-MM-DD or full ISO date)
 * @param maxAgeDays - Maximum age in days (optional, defaults to environment variable)
 * @returns true if the date is within maxAgeDays of today (or if date is null/undefined), false otherwise
 */
export const isDateValidForMtxVideo = (
  dateWanted: string | null | undefined,
  maxAgeDays?: number
): boolean => {
  const mtxVideoMaxAgeDays = maxAgeDays ?? getMtxVideoMaxAgeDays();
  // If no date provided, assume it's valid (loading state)
  if (!dateWanted) {
    return true;
  }

  // Parse today's date as YYYY-MM-DD to avoid timezone issues
  const today = new Date();
  const todayDateOnly = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  // Parse the target date - extract just the date part if it's a full ISO string
  const datePart = dateWanted.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  const targetDateOnly = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed

  const diffMs = todayDateOnly.getTime() - targetDateOnly.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Date must not be more than maxAgeDays in the past (future dates are allowed)
  return diffDays < mtxVideoMaxAgeDays;
};

/**
 * Check if a data type is valid for a given source and date.
 * This extends isDataTypeValidForSource by also checking date-based restrictions:
 * - mtxvideo is only valid for dates within the last N days
 * @param source - The data source
 * @param dataType - The type of data
 * @param dateWanted - Optional date to check (ISO string format). If not provided, only source validation is done.
 * @param maxAgeDays - Maximum age in days for mtxvideo (optional, defaults to environment variable)
 * @returns true if the data type is valid for the source and date
 */
export const isDataTypeValidForSourceAndDate = (
  source: Source,
  dataType: StoreDataType,
  dateWanted?: string,
  maxAgeDays?: number
): boolean => {
  // First check if data type is valid for the source
  if (!isDataTypeValidForSource(source, dataType)) {
    return false;
  }

  // If no date provided, just return source validity
  if (!dateWanted) {
    return true;
  }

  // Apply date-based restrictions for specific data types
  if (dataType === "mtxvideo") {
    return isDateValidForMtxVideo(dateWanted, maxAgeDays);
  }

  return true;
};

/**
 * Define which data types each pane type requires.
 * A pane is available for a source if ALL its required data types are supported by that source.
 * Panes with no data type requirements (like 'empty') are always available.
 */
export const PANE_DATA_TYPE_REQUIREMENTS: Record<string, StoreDataType[]> = {
  empty: [],
  video_downlink: ["videos", "mtxvideo"],
  video_non_downlink: ["videos", "mtxvideo"],
  photo: ["photos"],
  photo_all: ["photos"],
  iss_location: ["ephemeris", "daynight"],
  gps_location: ["gpstracks"],
  event_info: ["wikiEvas", "wikiTestEvents"], // needs at least one of these (handled specially)
  comm: ["talkybot"],
  graph: ["graph"],
};

/**
 * Check if a pane type is available for a given source.
 * A pane is available if at least one of its required data types is supported.
 */
export const isPaneAvailableForSource = (source: Source, paneType: string): boolean => {
  const requirements = PANE_DATA_TYPE_REQUIREMENTS[paneType];

  // If no requirements defined, assume pane is always available
  if (!requirements || requirements.length === 0) {
    return true;
  }

  // Pane is available if at least one required data type is supported
  return requirements.some((dataType) => isDataTypeValidForSource(source, dataType));
};

/**
 * Get all pane types that are available for a given source.
 */
export const getAvailablePanesForSource = (source: Source, allPaneTypes: string[]): string[] => {
  return allPaneTypes.filter((paneType) => isPaneAvailableForSource(source, paneType));
};
