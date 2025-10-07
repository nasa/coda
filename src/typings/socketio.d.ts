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
  wrappedResponse: WrappedResponse<any>;
}

// Define a configuration for each data type
interface DataFetchConfig {
  type: StoreDataType;
  getDataFunction: (params: {
    dateWanted: string;
    forceNew: boolean;
    source: Source;
  }) => Promise<any>;
}

/** Socket.io Server instantiation types */
interface ServerToClientEvents {
  noArg: () => void;
  statusFromServer: (payload: StatusFromServer) => void;
  dataUpdate: (payload: DataUpdate) => void;
  version: (version: AppVersion) => void; // server version sent to client
}

interface ClientToServerEvents {
  visitorJoin: (payload: VisitorData) => void;
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
