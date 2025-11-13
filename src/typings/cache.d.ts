type FetchStatus = "inprogress" | "complete" | "error";

/** New simplified metadata for fetch results - no caching concerns */
interface FetchMetadata {
  success: boolean;
  error?: string;
  timestamp: string;
  /** Indicates this data type is not applicable for the current source */
  unneeded?: boolean;
}

/** Legacy metadata with caching concerns - to be phased out */
interface ResponseMetadata {
  retrieverStatus: FetchStatus;
  cachedTimestamp: string;
  expiration: string;
  error: string;
  retrieverErrorCount: number;
  lastErrorTimestamp: string;
  mocked?: boolean;
}

/**
 * Contains all the possible subfolders for the cache.
 * This type is iterated through when clearing the entire cache
 */
type CacheFolder =
  | "celestrak"
  | "spacetrack"
  | "daynight/topo"
  | "daynight/issLocation"
  | "io"
  | "labs/transcripts"
  | "labs/audio"
  | "wiki"
  | "wiki/all"
  | "wiki/gps"
  | "test"
  | "labs/mtxPlayback"
  | "gps/tracks";

type CacheMetadata = {
  expiration: string;
};

type CacheRecord_db_type = {
  id: number;
  folder: string;
  cacheKey: string;
  data: unknown;
  metadata: CacheMetadata;
  createdAt: Date;
  lastAccessedAt: Date;
};
