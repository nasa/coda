/**
 * Define which data types are available for each source.
 * This mapping is used by both client and server code to ensure consistency.
 */
export const SOURCE_DATA_TYPE_MAP: Record<Source, StoreDataType[]> = {
  ISS: [
    "daynight",
    "ephemeris",
    "videos",
    "mtxvideo",
    "photos",
    "wikiEvas",
    "mtxvideo",
    "transcript",
    "sgaudio",
  ],
  TEST_EVENTS: [
    "videos",
    "mtxvideo",
    "photos",
    "wikiTestEvents",
    "mtxvideo",
    "transcript",
    "sgaudio",
    "graph",
    "gpstracks",
  ],
  NBL: ["videos", "photos", "wikiTestEvents", "mtxvideo", "transcript", "sgaudio", "graph"],
  ARTEMIS: ["videos", "photos", "wikiTestEvents", "mtxvideo", "transcript", "sgaudio"],
};

/**
 * Check if a data type is valid for a given source
 */
export const isDataTypeValidForSource = (source: Source, dataType: StoreDataType): boolean => {
  return SOURCE_DATA_TYPE_MAP[source]?.includes(dataType) ?? false;
};
