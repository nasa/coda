type RetrieverStatus = "inprogress" | "complete" | "error";

interface ResponseMetadata {
  retrieverStatus: RetrieverStatus;
  cachedTimestamp: string;
  expiration: string;
  error: string;
  mocked?: boolean;
  errorCount: number;
  lastErrorTimestamp: string;
}

/** This is the structure of the metadata object that we save within each caCache entry */
interface CaCacheMetadata {
  retrieverStatus: RetrieverStatus;
  cachedTimestamp: string; // ISO string
  expiration: string; // ISO string
  retrieverErrorDescription: string;
  errorCount: number; // number of times the retriever has been run and failed
  lastErrorTimestamp: string; // ISO string
}
