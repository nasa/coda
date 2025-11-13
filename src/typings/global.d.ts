type GlobalValues = {
  socketio: import("socket.io").Server<
    ClientToServerEvents,
    ServerToClientEvents,
    import("socket.io/dist/typed-events").DefaultEventsMap,
    {}
  >;
  ormCache: import("@mikro-orm/postgresql").MikroORM | null;
  serverSocketStatus: ServerSocketStatus;
  socketInterval: NodeJS.Timeout;
  appVersion: AppVersion | null;
  fetchTrackers: FetchTrackers;
};

// these are defined in esbuild.mjs and vite.config.mts
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
