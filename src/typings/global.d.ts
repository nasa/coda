type GlobalValues = {
  socketio: import("socket.io").Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
  ormCache: import("@mikro-orm/postgresql").MikroORM | null;
  serverSocketStatus: ServerSocketStatus;
  socketInterval: NodeJS.Timeout;
  serverDataRefreshTimeouts: {
    [source: string]: { [date: string]: { [dataType: string]: NodeJS.Timeout } };
  };
};
