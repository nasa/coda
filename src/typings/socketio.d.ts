/** Socket.io Server instantiation types */
interface ServerToClientEvents {
  noArg: () => void;
  statusFromServer: (payload: StatusFromServer) => void;
  transcriptSnippetFileFromServer: (payload: TranscriptSnippetFile) => void;
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
  room: string;
}

type ConnectionStatus = "connected" | "disconnected" | "connecting" | "reconnecting";

interface SocketStatus {
  connectionStatus: ConnectionStatus;
  lastStatusFromServer: StatusFromServer;
  clientVersion: string;
}

interface VisitorCounts {
  viewers: number;
}

interface StatusFromServer {
  viewers: number;
  timestamp: number;
  version: string;
}
