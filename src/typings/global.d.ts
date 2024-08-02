type GlobalValues = {
  socketio: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  ormCache: MikroORM<D>;
  socketio: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  serverSocketStatus: ServerSocketStatus;
  socketInterval: NodeJS.Timeout;
  emssVideoEnabled: boolean;
};
