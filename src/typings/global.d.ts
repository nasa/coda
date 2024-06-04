type GlobalValues = {
  ormCache: MikroORM<D>;
  socketio: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  serverSocketStatus: ServerSocketStatus;
  socketInterval: NodeJS.Timeout;
};
