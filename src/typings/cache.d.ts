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
