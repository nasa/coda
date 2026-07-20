import remove from "lodash/remove";
import find from "lodash/find";
import isEqual from "lodash/isEqual";
import { globalValues, getSocketIO } from "./global";
import { dataFetchConfigs, getSourceDateDataType, ALL_DATES_KEY } from "./dataRetrievalScheduler";
import { isDataTypeValidForSourceAndDate } from "utils/sourceDataTypeMap";
import type { DefaultEventsMap, Socket } from "socket.io";
import { ConsoleLogger } from "../../utils/logging/consoleLogger";
import { getTalkybotS2sSocketTrackerData } from "./talkybotS2sSocket";
import { findRestrictedAccessesForUser } from "./routes/db/accessGrants";

export const INSPECTOR_ROOM = "inspectorRoom";

const sanitizeServerFetchTrackers = (
  statuses: FetchTrackers
): FetchInspectorUpdate["fetchTrackersSanitized"] => {
  const sanitized: FetchInspectorUpdate["fetchTrackersSanitized"] = {};

  Object.entries(statuses ?? {}).forEach(([source, dateMap]) => {
    if (!dateMap) return;

    Object.entries(dateMap).forEach(([date, typeMap]) => {
      if (!typeMap) return;

      Object.entries(typeMap).forEach(([dataType, tracker]) => {
        if (!tracker) return;
        // pull out the timeoutObject so ...rest can be assigned later
        const { timeoutObject: _timeoutObject, ...rest } = tracker;

        if (!sanitized[source]) {
          sanitized[source] = {};
        }

        if (!sanitized[source][date]) {
          sanitized[source][date] = {};
        }

        sanitized[source][date][dataType] = { ...rest };
      });
    });
  });

  return sanitized;
};

// Convert all fetch tracker data from the server to a sanitized version for the fetch inspector
const buildFetchInspectorUpdate = (): FetchInspectorUpdate => {
  return {
    // Strip timeout Object to avoid sending non-serializable Node.js timers over the wire
    fetchTrackersSanitized: sanitizeServerFetchTrackers(globalValues.fetchTrackers),
    updatedAt: new Date().toISOString(),
  };
};

export const emitFetchInspectorUpdate = (): void => {
  const io = getSocketIO();
  const room = io.sockets?.adapter?.rooms?.get(INSPECTOR_ROOM);
  if (!room || room.size === 0) return;
  io.to(INSPECTOR_ROOM).emit("fetchInspectorUpdate", buildFetchInspectorUpdate());
};

// Emit TalkybotS2sSocket inspector update to all clients in the inspector room
export const emitTalkybotS2sSocketInspectorUpdate = (): void => {
  const io = getSocketIO();
  const room = io.sockets?.adapter?.rooms?.get(INSPECTOR_ROOM);
  if (!room || room.size === 0) return;
  io.to(INSPECTOR_ROOM).emit("talkybotS2sSocketInspectorUpdate", {
    status: getTalkybotS2sSocketTrackerData(),
    updatedAt: new Date().toISOString(),
  });
};

// Build visitor inspector update payload for the admin monitoring page
const buildVisitorInspectorUpdate = (): VisitorInspectorUpdate => {
  return {
    visitorsData: [...globalValues.serverSocketStatus.visitorsData],
    updatedAt: new Date().toISOString(),
  };
};

// Emit visitor inspector update to all clients in the inspector room
export const emitVisitorInspectorUpdate = (): void => {
  const io = getSocketIO();
  const room = io.sockets?.adapter?.rooms?.get(INSPECTOR_ROOM);
  if (!room || room.size === 0) return;
  io.to(INSPECTOR_ROOM).emit("visitorInspectorUpdate", buildVisitorInspectorUpdate());
};

// Emit SpaceTrack inspector update to all clients in the inspector room
export const emitSpacetrackInspectorUpdate = (): void => {
  const io = getSocketIO();
  const room = io.sockets?.adapter?.rooms?.get(INSPECTOR_ROOM);
  if (!room?.size) return;

  io.to(INSPECTOR_ROOM).emit("spacetrackInspectorUpdate", {
    status: { ...globalValues.spacetrackTrackerData },
    updatedAt: new Date().toISOString(),
  } as SpaceTrackTrackerDataUpdate);
};

export const setupSocketIO = (): void => {
  // initialize the global object that will store the visitor tracking data
  const visitorsData: VisitorData[] = globalValues.serverSocketStatus.visitorsData;
  const io = getSocketIO();

  // Listen for connection events
  io.on(
    "connection",
    (socket: Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, {}>) => {
      // emit app version to client that just connected
      if (globalValues.appVersion) {
        socket.emit("version", globalValues.appVersion);
      }

      socket.on("visitorJoin", (visitorData: VisitorData) => {
        try {
          // check app version and git commit
          if (
            globalValues.appVersion &&
            !isEqual(visitorData.appVersion, globalValues.appVersion)
          ) {
            ConsoleLogger.debug(
              `SocketIO - visitorJoin: appVersion mismatch between client and server
          client: ${JSON.stringify(visitorData.appVersion)}
          server: ${JSON.stringify(globalValues.appVersion)}`
            );
          }

          // join the new visitor to the room named the date they are viewing
          ConsoleLogger.debug(
            `New Client: Joining room ${visitorData.source}_${visitorData.dateViewing}`
          );
          socket.join(`${visitorData.source}_${visitorData.dateViewing}`);

          // set this visitor's information on the server's global
          // remove this socket from tracking list if it exists and push the new one
          remove(visitorsData, (item) => {
            return item.socketId === visitorData.socketId;
          });
          // Initialize liveVideoEnabled to true for new visitors
          visitorsData.push({ ...visitorData, liveVideoEnabled: true, restrictedAccesses: [] });

          // Compute restricted-override eligibility (auid-gated MediaOverride rows for this source+date)
          // and update the visitor record + emit fresh inspector update once available.
          findRestrictedAccessesForUser(
            visitorData.user,
            visitorData.source,
            visitorData.dateViewing
          )
            .then((accesses) => {
              const tracked = find(visitorsData, { socketId: visitorData.socketId });
              if (tracked) {
                tracked.restrictedAccesses = accesses;
                if (accesses.length > 0) {
                  emitVisitorInspectorUpdate();
                }
              }
            })
            .catch((err) => {
              ConsoleLogger.warn("findRestrictedAccessesForUser failed:", err);
            });

          // update the server data refresh timeouts object to possibly add this source/day if this is the first visitor currently viewing it
          updateServerFetchTrackers();

          // immediately emit any cached data we have for this visitor's source and date
          // if caches are missed in these calls, they are filled
          fetchAndEmitAllData({
            socket,
            visitorData,
          });

          // emit visitor count to all clients
          const statusFromServer = getStatusFromServer();
          io.emit("statusFromServer", statusFromServer);

          // emit updated visitor list to any admin monitoring the visitor inspector
          emitVisitorInspectorUpdate();
        } catch (error) {
          ConsoleLogger.error("SocketIO - visitorJoin: ", error);
        }
      });

      socket.on("joinInspector", () => {
        try {
          socket.join(INSPECTOR_ROOM);
          // Send all inspector updates on join - each admin page listens only to what it needs
          socket.emit("fetchInspectorUpdate", buildFetchInspectorUpdate());
          socket.emit("talkybotS2sSocketInspectorUpdate", {
            status: getTalkybotS2sSocketTrackerData(),
            updatedAt: new Date().toISOString(),
          });
          socket.emit("spacetrackInspectorUpdate", {
            status: { ...globalValues.spacetrackTrackerData },
            updatedAt: new Date().toISOString(),
          } as SpaceTrackTrackerDataUpdate);
          socket.emit("visitorInspectorUpdate", buildVisitorInspectorUpdate());
        } catch (error) {
          ConsoleLogger.error("SocketIO - joinInspector: ", error);
        }
      });

      socket.on("leaveInspector", () => {
        try {
          socket.leave(INSPECTOR_ROOM);
        } catch (error) {
          ConsoleLogger.error("SocketIO - leaveInspector: ", error);
        }
      });

      socket.on("disconnect", () => {
        try {
          const visitorBeingRemoved = find(visitorsData, {
            socketId: socket.id,
          });

          // remove this socket from the visitor tracking
          remove(visitorsData, (item) => {
            return item?.socketId === visitorBeingRemoved?.socketId;
          });

          // remove the source/day from the server data refresh timeouts object if no more visitors are viewing it
          updateServerFetchTrackers();

          // remove the visitor from the room named the date they are viewing
          socket.leave(`${visitorBeingRemoved?.source}_${visitorBeingRemoved?.dateViewing}`);

          const statusFromServer = getStatusFromServer();
          // emit visitor count to all clients
          socket.emit("statusFromServer", statusFromServer);

          // emit updated visitor list to any admin monitoring the visitor inspector
          emitVisitorInspectorUpdate();
        } catch (error) {
          ConsoleLogger.error("SocketIO - disconnect: ", error);
        }
      });

      // send visitor counts to all clients every 10 seconds
      // Only create the interval once and store it globally for cleanup during shutdown
      if (!globalValues.socketInterval) {
        globalValues.socketInterval = setInterval(() => {
          const statusFromServer = getStatusFromServer();
          io.emit("statusFromServer", statusFromServer);
        }, 10000);
      }
    }
  );
};

const getStatusFromServer = (): StatusFromServer => {
  return {
    visitorCount: globalValues.serverSocketStatus.visitorsData?.length,
    timestamp: Date.now(),
    serverVersion: globalValues.appVersion ?? { version: "", gitCommit: "" },
  };
};

export const emitDataUpdate = ({
  source,
  dataDate,
  dataUpdate,
}: {
  source: Source;
  dataDate: string;
  dataUpdate: DataUpdate;
}): void => {
  getSocketIO().to(`${source}_${dataDate}`).emit("dataUpdate", dataUpdate);
};

/**
 * Emit a data update to ALL clients viewing any date for a specific source.
 * Used for non-date-dependent data like wiki data that's the same for all dates.
 */
export const emitDataUpdateToSource = ({
  source,
  dataUpdate,
}: {
  source: Source;
  dataUpdate: DataUpdate;
}): void => {
  // Get all unique dates being viewed for this source
  const datesForSource = globalValues.serverSocketStatus.visitorsData
    .filter((visitor) => visitor.source === source)
    .map((visitor) => visitor.dateViewing);
  const uniqueDates = Array.from(new Set(datesForSource));

  // Emit to all rooms for this source
  const io = getSocketIO();
  uniqueDates.forEach((date) => {
    io.to(`${source}_${date}`).emit("dataUpdate", dataUpdate);
  });

  ConsoleLogger.debug(
    `Emitted ${dataUpdate.type} update to ${uniqueDates.length} rooms for source ${source}`
  );
};

/**
 * Emit an incremental data update to clients viewing a specific source and date.
 * Used for real-time updates (e.g., new audio files from talkybotS2sSocket).
 */
export const emitIncrementalDataUpdate = ({
  source,
  dataDate,
  incrementalUpdate,
}: {
  source: Source;
  dataDate: string;
  incrementalUpdate: IncrementalDataUpdate;
}): void => {
  ConsoleLogger.debug(
    `Emitting incremental ${incrementalUpdate.type} update to room ${source}_${dataDate}`
  );
  getSocketIO().to(`${source}_${dataDate}`).emit("incrementalDataUpdate", incrementalUpdate);
};

/**
 * When a new client connects or an existing client disconnects, update the server fetch tracker object
 */
const updateServerFetchTrackers = () => {
  // Generate unique keys in the format "source_date"
  const uniqueSourceDateKeys = Array.from(
    new Set(
      globalValues.serverSocketStatus.visitorsData.map(
        (visitor) => `${visitor.source}_${visitor.dateViewing}`
      )
    )
  );

  // Get unique sources being viewed (for non-date-dependent data)
  const uniqueSources = Array.from(
    new Set(globalValues.serverSocketStatus.visitorsData.map((visitor) => visitor.source))
  );

  //Create new source_date values for new dates being viewed
  uniqueSourceDateKeys.forEach((key) => {
    const [source, date] = key.split("_");
    if (!globalValues.fetchTrackers[source]) {
      globalValues.fetchTrackers[source] = {};
    }
    if (!globalValues.fetchTrackers[source][date]) {
      globalValues.fetchTrackers[source][date] = {};
    }

    dataFetchConfigs.forEach((config) => {
      // Skip non-date-dependent configs here - they use the global key
      if (!config.isDateDependent) return;

      if (!globalValues.fetchTrackers[source][date][config.type]) {
        globalValues.fetchTrackers[source][date][config.type] = {
          isFetching: false,
        };
      }
    });
  });

  // Create global tracker entries for non-date-dependent data (e.g., wiki data)
  uniqueSources.forEach((source) => {
    if (!globalValues.fetchTrackers[source]) {
      globalValues.fetchTrackers[source] = {};
    }
    if (!globalValues.fetchTrackers[source][ALL_DATES_KEY]) {
      globalValues.fetchTrackers[source][ALL_DATES_KEY] = {};
    }

    dataFetchConfigs.forEach((config) => {
      if (config.isDateDependent) return;

      if (!globalValues.fetchTrackers[source][ALL_DATES_KEY][config.type]) {
        globalValues.fetchTrackers[source][ALL_DATES_KEY][config.type] = {
          isFetching: false,
        };
      }
    });
  });

  // Clean up the server fetch trackers: remove any source_date values that are no longer being viewed and dispose of timeouts
  Object.keys(globalValues.fetchTrackers).forEach((source) => {
    Object.keys(globalValues.fetchTrackers[source]).forEach((date) => {
      // For all-dates key, keep it as long as any visitor is viewing this source
      const shouldKeep =
        date === ALL_DATES_KEY
          ? uniqueSources.includes(source as Source)
          : uniqueSourceDateKeys.includes(`${source}_${date}`);

      if (!shouldKeep) {
        Object.keys(globalValues.fetchTrackers[source][date]).forEach((type) => {
          const status = globalValues.fetchTrackers[source][date][type];
          if (status?.timeoutObject) {
            ConsoleLogger.debug(`${type} Clearing timeout for ${source}_${date}`);
            clearTimeout(status.timeoutObject);
          }
        });

        // Delete the entire date entry from serverDataRefresh
        delete globalValues.fetchTrackers[source][date];
      }
    });

    // Clean up empty source objects
    if (Object.keys(globalValues.fetchTrackers[source]).length === 0) {
      delete globalValues.fetchTrackers[source];
    }
  });

  emitFetchInspectorUpdate();
};

/**
 * This function fetches all data for a new client and emits it to the new client.
 * This also has the effect of starting the data refresh timeouts for the source_date values
 */
const fetchAndEmitAllData = async ({
  socket,
  visitorData,
}: {
  socket: Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, object>;
  visitorData: VisitorData;
}): Promise<void> => {
  // Create an array to store promises for parallel execution
  const fetchPromises = [];

  // Loop through each data fetch config
  for (const dataFetchConfig of dataFetchConfigs) {
    // Skip data types that are not valid for this source and date
    if (
      !isDataTypeValidForSourceAndDate(
        visitorData.source,
        dataFetchConfig.type,
        visitorData.dateViewing
      )
    ) {
      ConsoleLogger.debug(
        `${dataFetchConfig.type} Skipping for source ${visitorData.source} on ${visitorData.dateViewing} (not available)`
      );
      continue;
    }

    // Create and store promise for this fetch operation
    const fetchPromise = (async () => {
      ConsoleLogger.debug(
        `${dataFetchConfig.type} New Client: Fetching data to new client for ${visitorData.source}_${visitorData.dateViewing}`
      );

      const response = await getSourceDateDataType({
        source: visitorData.source,
        dateWanted: visitorData.dateViewing,
        dataFetchConfig,
      });
      if (!response) return; // any errors generated from above are already logged

      socket.emit("dataUpdate", {
        type: dataFetchConfig.type,
        response,
      });
    })();

    fetchPromises.push(fetchPromise);
  }

  // Wait for all fetches to complete
  await Promise.all(fetchPromises);
};
