declare type LaunchpadUser = import("@emss/oauth2-proxy-common").EmssUser;

type StoreDataType =
  | "daynight"
  | "ephemeris"
  | "videos"
  | "photos"
  | "wikiEvas"
  | "wikiTestEvents"
  | "mtxvideo"
  | "gpstracks"
  | "transcript"
  | "sgaudio"
  | "graph";

interface DataUpdate {
  type: StoreDataType;
  response: FetchResponse<any>;
}

interface DataFetchCallContext {
  dateWanted: string;
  source: Source;
  timeoutMs?: number;
}

// Define a configuration for each data type
interface FetchConfig {
  type: StoreDataType;
  getDataFunction: (params: DataFetchCallContext) => Promise<FetchResponse<any>>;
  timeoutMs?: number;
  refreshIntervalMs?: number; // custom refresh interval, defaults to DATA_REFRESH_INTERVAL_MS
  refreshIntervalTodayMs?: number; // custom refresh interval for today's data
  disableCacheUse?: boolean; // whether to disable the use of cache for this data type
}

interface FetchTrackerData {
  // current fetching details
  isFetching: boolean; // is a current fetch underway
  fetchStartedAt?: string; // if a current fetch is underway, when did it start

  // last fetch details
  lastFetchStartedAt?: string; // last fetch start datetime
  lastFetchCompletedAt?: string; // last fetch completion datetime
  lastFetchDurationMs?: number; // duration of last fetch in milliseconds
  lastResultWasSuccess?: boolean; // was the last fetch successful
  lastSuccessAt?: string; // last successful fetch datetime. May not be the same as lastFetchCompletedAt if the last fetch failed
  lastErrorAt?: string; // if the last fetch failed, when did it complete
  lastErrorMessage?: string; // if the last fetch failed, what was the error message

  // cache details
  cacheExpiration?: string;
  lastCacheHitAt?: string; // the last time someone requested data and it was delivered from cache
  lastCacheMissAt?: string; // the last time someone requested data but it was not in cache, so null was returned

  // timeout object
  timeoutObject?: NodeJS.Timeout; // the timeout object for this data
  timeoutCreatedAt?: string; // datetime when the timeout object was initialized
  timeoutDelayMs?: number; // delay for when the timeout callback function is set to run
  nextTimeoutTriggerAt?: string; // then datetime when the timeout callback function will trigger. Essentially createdAt + delay
  lastTimeoutTriggeredAt?: string; // last datetime when the timeout object triggered and callback function was run

  // socket emit details
  lastEmitAt?: string; // last time data was sent to all clients
  lastEmitSkippedAt?: string; // last time an emit was skipped due to no data change
}
type FetchTrackerDataSanitized = Omit<FetchTrackerData, "timeoutObject">;

type FetchTrackers = {
  [source: string]: {
    [date: string]: {
      [dataType: string]: FetchTrackerData;
    };
  };
};

type FetchTrackersSanitized = {
  [source: string]: {
    [date: string]: {
      [dataType: string]: FetchTrackerDataSanitized;
    };
  };
};

interface FetchInspectorUpdate {
  fetchTrackersSanitized: FetchTrackersSanitized;
  updatedAt: string;
}

/** Socket.io Server instantiation types */
interface ServerToClientEvents {
  noArg: () => void;
  statusFromServer: (payload: StatusFromServer) => void;
  dataUpdate: (payload: DataUpdate) => void;
  version: (version: AppVersion) => void; // server version sent to client
  fetchInspectorUpdate: (payload: FetchInspectorUpdate) => void;
}

interface ClientToServerEvents {
  visitorJoin: (payload: VisitorData) => void;
  joinFetchInspector: () => void;
  leaveFetchInspector: () => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface ServerSocketStatus {
  visitorsData: VisitorData[];
}

interface VisitorData {
  socketId: string;
  dateViewing: string;
  source: Source;
  appVersion: AppVersion;
  user: LaunchpadUser;
  connectedAt: number;
}

type ConnectionStatus = "connected" | "disconnected" | "connecting" | "reconnecting" | "failed";

// socket status for the client
interface ClientSocketStatus {
  connectionStatus: ConnectionStatus;
  lastStatusFromServer: StatusFromServer;
  clientVersion: AppVersion;
}

interface StatusFromServer {
  visitorCount: number;
  timestamp: number;
  serverVersion: AppVersion;
}

interface AppVersion {
  version: string;
  gitCommit: string;
}
