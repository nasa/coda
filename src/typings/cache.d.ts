type FetchStatus = "inprogress" | "complete" | "error";

/** New simplified metadata for fetch results - no caching concerns */
interface FetchMetadata {
  success: boolean;
  error?: string;
  timestamp: string;
  /** Indicates this data type is not applicable for the current source */
  unneeded?: boolean;
}

/** New simplified response type focused on fetch success/failure - no caching concerns */
interface FetchResponse<T> {
  data: T;
  fetchMetadata: FetchMetadata;
  origin?: string; // where the data came from
}

type CacheMetadata = {
  expiration: string;
};

type CacheRecord = {
  id: number;
  folder: string;
  cacheKey: string;
  data: unknown;
  metadata: CacheMetadata;
  createdAt: Date;
  lastAccessedAt: Date;
};
