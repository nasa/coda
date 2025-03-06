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
  version: (payload: string) => void;
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

interface SocketData {
  name: string;
  age: number;
}

interface VisitorData {
  socketId: string;
  dateViewing: string;
  source: Source;
  user: EmssUser;
}

type ConnectionStatus = "connected" | "disconnected" | "connecting" | "reconnecting";

interface SocketStatus {
  connectionStatus: ConnectionStatus;
  lastStatusFromServer: StatusFromServer;
  clientVersion: string;
}

interface StatusFromServer {
  users: EmssUser[];
  timestamp: number;
  version: string;
}
