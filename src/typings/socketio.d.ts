declare type LaunchpadUser = import("@emss/oauth2-proxy-common").EmssUser;

type StoreDataType =
  | "daynight"
  | "ephemeris"
  | "videos"
  | "photos"
  | "wikiEvas"
  | "wikiTestEvents"
  | "wikiArtemisTraining"
  | "mtxvideo"
  | "gpstracks"
  | "talkybot"
  | "graph";

interface DataUpdate {
  type: StoreDataType;
  response: FetchResponse<unknown>;
}

interface DataFetchCallContext {
  dateWanted: string;
  source: Source;
}

// Define a configuration for each data type
interface FetchConfig {
  type: StoreDataType;
  getDataFunction:
    | ((params: { dateWanted: string; source: Source }) => Promise<FetchResponse<unknown>>)
    | ((params: { dateWanted: string }) => Promise<FetchResponse<unknown>>)
    | (() => Promise<FetchResponse<unknown>>);
  fetchTimeoutMs: number; // custom fetch timeout in milliseconds, defaults to DEFAULT_DATA_FETCH_TIMEOUT_MS
  refreshIntervalMs: number | null; // custom refresh interval for non-today data, null means no scheduled refresh
  refreshIntervalTodayMs: number | null; // custom refresh interval for today's data, null means no scheduled refresh
  enableCacheUse: boolean; // whether to enable the use of cache for this data type
  isDateDependent?: boolean; // if true, data varies by date and uses per-date cache entries; if false, data is the same for all dates and uses a global cache entry
}

/** Incremental data updates for single items (e.g., new audio file from talkybotS2sSocket) */
interface IncrementalDataUpdate {
  type: StoreDataType;
  item: unknown;
}

// ============================================================================
// Fetch Tracker (Data Retrieval Scheduler)
// ============================================================================

interface FetchTrackerData {
  // Error tracking
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;

  // Operation tracking
  lastOperationStartedAt?: string | null;
  lastOperationCompletedAt?: string | null;
  lastOperationDurationMs?: number | null;
  lastOperationSuccess?: boolean | null;
  lastSuccessAt?: string | null;
  // current fetching details
  isFetching: boolean; // is a current fetch underway
  fetchStartedAt?: string; // if a current fetch is underway, when did it start

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

// ============================================================================
// TalkybotS2sSocket Tracker (Talkybot Connection)
// ============================================================================

/** TalkybotS2sSocket (Server-to-Server) Tracker Data for Talkybot connection monitoring */
interface TalkybotS2sSocketTrackerData {
  // Error tracking
  lastErrorAt: string | null;
  lastErrorMessage: string | null;

  // Connection state
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  connectedAt: string | null;
  disconnectedAt: string | null;

  // Configuration
  targetUrl: string | null;
  socketPath: string;
  socketId: string | null;

  // Reconnection tracking
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  lastReconnectAttemptAt: string | null;

  // Message tracking
  messagesReceived: number;
  lastMessageReceivedAt: string | null;
  lastMessageType: string | null;
  lastMessagePreview: string | null;

  // Talkybot server info
  talkybotVersion: string | null;
  lastStatusFromTalkybot: {
    timestamp: number;
    version: string;
  } | null;

  // Audio file tracking
  audioFilesReceived: number;
  lastAudioFileReceivedAt: string | null;
  lastAudioFileUuid: string | null;
  lastAudioFilePreview: string | null;
}

interface TalkybotS2sSocketTrackerDataUpdate {
  status: TalkybotS2sSocketTrackerData;
  updatedAt: string;
}

// ============================================================================
// SpaceTrack TLE Scheduler Tracker
// ============================================================================

/** SpaceTrack TLE Update Scheduler Tracker Data for admin monitoring */
interface SpaceTrackTrackerData {
  // Error tracking
  lastErrorAt: string | null;
  lastErrorMessage: string | null;

  // Operation tracking
  lastOperationStartedAt: string | null;
  lastOperationCompletedAt: string | null;
  lastOperationDurationMs: number | null;
  lastOperationSuccess: boolean | null;
  lastSuccessAt: string | null;

  // Scheduler tracking
  isActive: boolean;
  intervalMs: number;
  startedAt: string | null;
  nextOperationAt: string | null;

  // Statistics tracking
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;

  // SpaceTrack-specific: last fetched epoch from TLE data
  lastFetchedEpoch: string | null;

  // SpaceTrack-specific: records inserted/skipped in last operation
  lastRecordsInserted: number | null;
  lastRecordsSkipped: number | null;

  // Manual trigger info
  lastManualTriggerAt: string | null;
  lastManualTriggerBy: string | null;
}

interface SpaceTrackTrackerDataUpdate {
  status: SpaceTrackTrackerData;
  updatedAt: string;
}

/** Result of determining whether to fetch from SpaceTrack */
interface SpaceTrackFetchDecision {
  shouldFetch: boolean;
  skipReason: string;
}

/** Socket.io Server instantiation types */
interface ServerToClientEvents {
  noArg: () => void;
  statusFromServer: (payload: StatusFromServer) => void;
  dataUpdate: (payload: DataUpdate) => void;
  incrementalDataUpdate: (payload: IncrementalDataUpdate) => void;
  version: (version: AppVersion) => void; // server version sent to client
  fetchInspectorUpdate: (payload: FetchInspectorUpdate) => void;
  talkybotS2sSocketInspectorUpdate: (payload: TalkybotS2sSocketTrackerDataUpdate) => void;
  spacetrackInspectorUpdate: (payload: SpaceTrackTrackerDataUpdate) => void;
  visitorInspectorUpdate: (payload: VisitorInspectorUpdate) => void;
  liveVideoRestrictionUpdate: (payload: LiveVideoRestrictionUpdate) => void; // sent to individual clients when their restriction status changes
}

interface ClientToServerEvents {
  visitorJoin: (payload: VisitorData) => void;
  joinInspector: () => void;
  leaveInspector: () => void;
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
  liveVideoEnabled: boolean;
}

// ============================================================================
// Live Video Restriction Events
// ============================================================================

/** Update sent to all clients about their live video restriction status */
interface LiveVideoRestrictionUpdate {
  disabled: boolean;
}

/** Visitor inspector update with live video restriction info */
interface VisitorInspectorUpdate {
  visitorsData: VisitorData[];
  updatedAt: string;
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
