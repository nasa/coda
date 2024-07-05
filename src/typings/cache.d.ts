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

/** This is the structure of the metadata object that we save within each caCache entry */
interface CaCacheMetadata {
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
  | "media"
  | "wiki"
  | "wiki/all"
  | "wiki/gps"
  | "test";
