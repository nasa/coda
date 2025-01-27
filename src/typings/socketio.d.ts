/** Socket.io Server instantiation types */
interface ServerToClientEvents {
  noArg: () => void;
  statusFromServer: (payload: StatusFromServer) => void;
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
