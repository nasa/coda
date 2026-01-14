type GlobalValues = {
  socketio:
    | import("socket.io").Server<
        ClientToServerEvents,
        ServerToClientEvents,
        import("socket.io/dist/typed-events").DefaultEventsMap,
        {}
      >
    | null;
  orm: import("@mikro-orm/postgresql").MikroORM | null;
  serverSocketStatus: ServerSocketStatus;
  socketInterval: NodeJS.Timeout | null;
  appVersion: AppVersion | null;
  fetchTrackers: FetchTrackers;
  talkybotS2sSocket: import("socket.io-client").Socket | null;
  spacetrackInterval: NodeJS.Timeout | null;
  spacetrackTrackerData: SpaceTrackTrackerData;
};

// these are defined in esbuild.mjs and vite.config.mts
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
