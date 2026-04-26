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
  deployInfo: DeployInfo | null;
  fetchTrackers: FetchTrackers;
  talkybotS2sSocket: import("socket.io-client").Socket | null;
  spacetrackInterval: NodeJS.Timeout | null;
  spacetrackTrackerData: SpaceTrackTrackerData;
};

interface DeployInfo {
  app: string;
  gitCommit: string;
  branch: string;
  deployedBy: string;
  deployedAt: string;
  mrIid: string;
  pipelineUrl: string;
}

// these are defined in esbuild.mjs and vite.config.mts
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
declare const __DEPLOY_APP__: string;
declare const __DEPLOY_BRANCH__: string;
declare const __DEPLOY_USER__: string;
declare const __DEPLOY_TIMESTAMP__: string;
declare const __DEPLOY_MRS__: string;
declare const __DEPLOY_PIPELINE_URL__: string;
