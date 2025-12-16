const createInitialCelestrakState = (): CelestrakTrackerData => ({
  isActive: false,
  intervalMs: 3 * 60 * 60 * 1000,
  startedAt: null,
  nextOperationAt: null,
  lastOperationStartedAt: null,
  lastOperationCompletedAt: null,
  lastOperationDurationMs: null,
  lastOperationSuccess: null,
  lastSuccessAt: null,
  lastFetchedEpoch: null,
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
  celestrakInterval: null,
  celestrakTrackerData: createInitialCelestrakState(),
};
