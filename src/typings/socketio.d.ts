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

type EMSSRole =
  | "AEGIS-Editor"
  | "AEGIS-Superuser"
  | "CODA-Superuser"
  | "Maestro-Superuser"
  | "EMSS-Superuser";

type EmssUser = {
  uupic: string;
  email: string;
  auid: string;
  givenname: string;
  surname: string;
  display_name: string;
  roles: EMSSRole[];
  uscitizen: boolean;
  legal_permanent_resident: boolean;
  usperson: boolean;
  ip_address: string;
};

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
