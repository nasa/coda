const createInitialSpacetrackState = (): SpaceTrackTrackerData => ({
  isActive: false,
  intervalMs: 6 * 60 * 60 * 1000, // 6 hours
  startedAt: null,
  nextOperationAt: null,
  lastOperationStartedAt: null,
  lastOperationCompletedAt: null,
  lastOperationDurationMs: null,
  lastOperationSuccess: null,
  lastSuccessAt: null,
  lastFetchedEpoch: null,
  lastRecordsInserted: null,
  lastRecordsSkipped: null,
  lastErrorMessage: null,
  lastErrorAt: null,
  totalOperations: 0,
  successfulOperations: 0,
  failedOperations: 0,
  lastManualTriggerAt: null,
  lastManualTriggerBy: null,
});

export const globalValues: GlobalValues = {
  socketio: null,
  serverSocketStatus: {
    visitorsData: [],
  },
  orm: null,
  socketInterval: null,
  appVersion: null,
  fetchTrackers: {},
  talkybotS2sSocket: null,
  spacetrackInterval: null,
  spacetrackTrackerData: createInitialSpacetrackState(),
};
