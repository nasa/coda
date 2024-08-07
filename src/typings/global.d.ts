type GlobalValues = {
  socketio: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  ormCache: MikroORM<D>;
  serverSocketStatus: ServerSocketStatus;
  socketInterval: NodeJS.Timeout;
  emssVideoEnabled: boolean;
};
