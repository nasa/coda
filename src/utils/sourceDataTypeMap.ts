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
  ARTEMIS: ["videos", "photos", "wikiTestEvents", "mtxvideo", "talkybot", "pcdAudio"],
};

/**
 * Check if a data type is valid for a given source
 */
export const isDataTypeValidForSource = (source: Source, dataType: StoreDataType): boolean => {
  return SOURCE_DATA_TYPE_MAP[source]?.includes(dataType) ?? false;
};

/**
 * Get all sources that support a given data type
 */
export const getSourcesWithDataType = (dataType: StoreDataType): Source[] => {
  return (Object.entries(SOURCE_DATA_TYPE_MAP) as [Source, StoreDataType[]][])
    .filter(([, dataTypes]) => dataTypes.includes(dataType))
    .map(([source]) => source);
};

/**
 * Mapping from Talkybot group slugs to CODA sources, given the channel's `sim` flag.
 *
 * Talkybot exposes TWO orthogonal dimensions per channel: a `sim` boolean (sim vs
 * mission) and a `group` slug (iss / artemis / test / sim / ...). CODA only cares
 * about one distinction: ISS-encoder mission traffic vs everything else. The rules:
 *
 *   - group="iss" + sim=false (real ISS mission)         -> ISS only
 *   - group="iss" + sim=true  (simulated ISS)            -> nowhere (never shown in CODA)
 *   - any other (group, sim) combination                 -> both TEST_EVENTS and ARTEMIS
 *     (treated as "miscellaneous" non-ISS content, regardless of whether it's a
 *     sim or a real mission - they're collapsed together in CODA)
 *
 * Unknown group slugs fall through to the miscellaneous bucket rather than being
 * dropped, so newly-added talkybot groups don't silently disappear from CODA.
 */
const MISCELLANEOUS_TALKYBOT_SOURCES: Source[] = ["TEST_EVENTS", "ARTEMIS"];

const TALKYBOT_GROUP_TO_SOURCES_MAP: Record<string, (sim: boolean) => Source[]> = {
  // Sim ISS traffic is intentionally dropped (returns []), so it never appears in CODA.
  iss: (sim) => (sim ? [] : ["ISS"]),
  test: () => MISCELLANEOUS_TALKYBOT_SOURCES,
  sim: () => MISCELLANEOUS_TALKYBOT_SOURCES,
  artemis: () => MISCELLANEOUS_TALKYBOT_SOURCES,
};

/**
 * Get the CODA sources for a Talkybot (group slug, sim flag) pair. A single talkybot
 * group can surface in multiple CODA sources, or in none at all (e.g. simulated ISS).
 * Unknown slugs fall through to the miscellaneous bucket.
 */
export const getSourcesForTalkybotGroup = (groupSlug: string, sim: boolean): Source[] => {
  const resolver = TALKYBOT_GROUP_TO_SOURCES_MAP[groupSlug];
  return resolver ? resolver(sim) : MISCELLANEOUS_TALKYBOT_SOURCES;
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
  pcd_audio: ["pcdAudio"],
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
 * Check if a pane type is available for the given date.
 * Panes without a dynamic date gate are always available.
 * Panes with a gate require a date within the gate range; if date is null/undefined they are hidden.
 *
 * @param paneDateRanges - Date ranges keyed by pane type (e.g. from pcdAudio Redux state).
 */
export const isPaneAvailableForDate = (
  paneType: string,
  date: string | null | undefined,
  paneDateRanges?: Partial<Record<string, { start: string; end: string } | null>>
): boolean => {
  const gate = paneDateRanges?.[paneType];
  if (!gate) return true;
  if (!date) return false;
  const d = date.split("T")[0];
  return d >= gate.start && d <= gate.end;
};

/**
 * Get all pane types that are available for a given source and optional date.
 * When date is provided, date-gated panes are filtered out if the date is outside their gate.
 * When date is undefined, date filtering is skipped (backward-compatible).
 *
 * @param paneDateRanges - Date ranges keyed by pane type (e.g. from pcdAudio Redux state).
 */
export const getAvailablePanesForSource = (
  source: Source,
  allPaneTypes: PaneType[],
  date?: string | null,
  dynamicGates?: Partial<Record<string, { start: string; end: string } | null>>
): PaneType[] => {
  return allPaneTypes.filter((paneType) => {
    if (!isPaneAvailableForSource(source, paneType)) return false;
    if (date !== undefined && !isPaneAvailableForDate(paneType, date, dynamicGates)) return false;
    return true;
  });
};
