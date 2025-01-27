type GlobalValues = {
  socketio: import("socket.io").Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
  ormCache:
    | import("@mikro-orm/core").MikroORM<import("@mikro-orm/postgresql").PostgreSqlDriver>
    | null;
  serverSocketStatus: ServerSocketStatus;
  socketInterval: NodeJS.Timeout;
  emssVideoEnabled: boolean;
};
