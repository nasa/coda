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

/**
 * Injected at build time by vite.config.mts via `define`. Holds the Vite
 * `base` (e.g. '/' or '/__BASE_URL__/'). Reading from this global — rather
 * than `import.meta.env.BASE_URL` directly — keeps modules that use the
 * base URL loadable by non-Vite contexts (Playwright transform, ts-node,
 * vitest under CJS). The literal `import.meta` syntax causes those loaders
 * to promote files to ESM and then fail on emitted `exports`. See
 * imago/docs/consumer-base-url-rewrite.md §6.
 */
// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
declare const __VITE_BASE_URL__: string | undefined;
