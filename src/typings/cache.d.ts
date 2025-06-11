type RetrieverStatus = "inprogress" | "complete" | "error";

interface ResponseMetadata {
  retrieverStatus: RetrieverStatus;
  cachedTimestamp: string;
  expiration: string;
  error: string;
  retrieverErrorCount: number;
  lastErrorTimestamp: string;
  mocked?: boolean;
}

/** This is the structure of the metadata object that we save within each cache entry */
interface CacheMetadata {
  retrieverStatus: RetrieverStatus;
  cachedTimestamp: string; // ISO string
  expiration: string; // ISO string
  retrieverErrorDescription: string;
  retrieverErrorCount: number; // number of times the retriever has been run and failed
  lastErrorTimestamp: string; // ISO string
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

type SocketCacheMetadata = {
  expiration: string;
  retrieving: boolean;
};

type CacheRecord_db_type = {
  id: number;
  folder: string;
  cacheKey: string;
  data: unknown;
  metadata: CacheMetadata | SocketCacheMetadata;
  createdAt: Date;
  lastAccessedAt: Date;
};
