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
  spacetrackInterval: null,
  spacetrackTrackerData: createInitialSpacetrackState(),
};

/**
 * Gets the ORM instance, throwing if not initialized.
 * Use this in route handlers where the server must be fully initialized.
 */
export function getORM(): import("@mikro-orm/postgresql").MikroORM {
  if (!globalValues.orm) {
    throw new Error("ORM not initialized");
  }
  return globalValues.orm;
}

/**
 * Gets the Socket.IO server instance, throwing if not initialized.
 * Use this in code that requires Socket.IO to be ready (e.g., setupSocketIO).
 */
export function getSocketIO(): NonNullable<GlobalValues["socketio"]> {
  if (!globalValues.socketio) {
    throw new Error("Socket.IO server not initialized");
  }
  return globalValues.socketio;
}

/**
 * Gets the app version, throwing if not initialized.
 */
export function getAppVersion(): AppVersion {
  if (!globalValues.appVersion) {
    throw new Error("App version not initialized");
  }
  return globalValues.appVersion;
}
