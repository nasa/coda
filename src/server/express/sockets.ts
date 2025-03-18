import packagejson from "../../../package.json";
import remove from "lodash/remove";
import find from "lodash/find";
import { globalValues } from "./global";
import { dataFetchConfigs, getSourceDateDataType } from "./dataRetrievalScheduler";
import { Socket } from "socket.io";
import { ConsoleLogger } from "../../utils/logger";

export const setupSocketIO = (): void => {
  // initialize the global object that will store the visitor tracking data and last edit events

  const visitorsData: VisitorData[] = globalValues.serverSocketStatus.visitorsData;
  let socketInterval: NodeJS.Timeout = null;
  const io = globalValues.socketio;

  // Listen for connection events
  io.on(
    "connection",
    (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
      // emit app version to client that just connected
      socket.emit("version", packagejson.version || "unknown version");

      socket.on("visitorJoin", (visitorData: VisitorData) => {
        // remove this socket from tracking list if it exists
        remove(visitorsData, (item) => {
          return item.socketId === visitorData.socketId;
        });
        visitorsData.push(visitorData);

        // join the new visitor to the room named the date they are viewing
        ConsoleLogger.log(
          `New Client: Joining room ${visitorData.source}_${visitorData.dateViewing}`
        );
        socket.join(`${visitorData.source}_${visitorData.dateViewing}`);

        // update the server data refresh timeouts object to possibly add this source/day if this is the first visitor currently viewing it
        updateServerDataRefreshTimeoutsObject();

        // immediately emit any cacached data we have for this visitor's source and date
        // if caches are missed in these calls, they are filled
        fetchAndEmitAllData({
          socket,
          visitorData,
        });

        const statusFromServer = getStatusFromServer();
        // emit visitor count to all clients
        io.emit("statusFromServer", statusFromServer);
      });

      socket.on("disconnect", () => {
        const visitorBeingRemoved = find(visitorsData, {
          socketId: socket.id,
        });

        // remove this socket from the visitor tracking
        remove(visitorsData, (item) => {
          return item?.socketId === visitorBeingRemoved?.socketId;
        });

        // remove the source/day from the server data refresh timeouts object if no more visitors are viewing it
        updateServerDataRefreshTimeoutsObject();

        // remove the visitor from the room named the date they are viewing
        socket.leave(`${visitorBeingRemoved?.source}_${visitorBeingRemoved?.dateViewing}`);

        const statusFromServer = getStatusFromServer();
        // emit visitor count to all clients
        socket.emit("statusFromServer", statusFromServer);
      });

      // send visitor counts to all clients every 10 seconds
      if (!socketInterval) {
        socketInterval = setInterval(() => {
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
    version: packagejson.version || "",
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
  globalValues.socketio.to(`${source}_${dataDate}`).emit("dataUpdate", dataUpdate);
};

/**
 * When a new client connects or an existing client disconnects, update the server data refresh timeouts object
 */
const updateServerDataRefreshTimeoutsObject = () => {
  // Generate unique keys in the format "source_date"
  const uniqueSourceDateKeys = Array.from(
    new Set(
      globalValues.serverSocketStatus.visitorsData.map(
        (visitor) => `${visitor.source}_${visitor.dateViewing}`
      )
    )
  );

  //Create new source_date values for new dates being viewed
  uniqueSourceDateKeys.forEach((key) => {
    const [source, date] = key.split("_");
    if (!globalValues.serverDataRefreshTimeouts[source]) {
      globalValues.serverDataRefreshTimeouts[source] = {};
    }
    if (!globalValues.serverDataRefreshTimeouts[source][date]) {
      globalValues.serverDataRefreshTimeouts[source][date] = {};
      dataFetchConfigs.forEach((config) => {
        globalValues.serverDataRefreshTimeouts[source][date][config.type] = null;
      });
    }
  });

  // Clean up the server data refresh timeouts: remove any source_date values that are no longer being viewed and dispose of timeouts
  Object.keys(globalValues.serverDataRefreshTimeouts).forEach((source) => {
    Object.keys(globalValues.serverDataRefreshTimeouts[source]).forEach((date) => {
      if (!uniqueSourceDateKeys.includes(`${source}_${date}`)) {
        Object.keys(globalValues.serverDataRefreshTimeouts[source][date]).forEach((type) => {
          ConsoleLogger.log(`${type} Clearing timeout for ${source}_${date}`);
          clearTimeout(globalValues.serverDataRefreshTimeouts[source][date][type]);
          globalValues.serverDataRefreshTimeouts[source][date][type] = null;
        });
      }
    });
  });
};

/**
 * This function fetches all data for a new client and emits it to the new client.
 * This also has the effect of starting the data refresh timeouts for the source_date values
 */
const fetchAndEmitAllData = async ({
  socket,
  visitorData,
}: {
  socket: any;
  visitorData: VisitorData;
}): Promise<void> => {
  // Create an array to store promises for parallel execution
  const fetchPromises = [];

  // Loop through each data fetch config
  for (const dataFetchConfig of dataFetchConfigs) {
    // Only run wikiEvas when source is ISS
    if (dataFetchConfig.type === "wikiEvas" && visitorData.source !== "ISS") continue;
    // Only run wikiTestEvents when source is TEST_EVENTS
    if (dataFetchConfig.type === "wikiTestEvents" && visitorData.source !== "TEST_EVENTS") continue;

    // Create and store promise for this fetch operation
    const fetchPromise = (async () => {
      ConsoleLogger.log(
        `${dataFetchConfig.type} New Client: Fetching data to new client for ${visitorData.source}_${visitorData.dateViewing}`
      );

      const wrappedResponse = await getSourceDateDataType({
        source: visitorData.source,
        dateWanted: visitorData.dateViewing,
        dataFetchConfig,
      });

      if (!wrappedResponse) {
        ConsoleLogger.error(
          `${dataFetchConfig.type} Error fetching cached data for ${visitorData.source}_${visitorData.dateViewing}`
        );
        return;
      }

      socket.emit("dataUpdate", {
        type: dataFetchConfig.type,
        wrappedResponse,
      });
    })();

    fetchPromises.push(fetchPromise);
  }

  // Wait for all fetches to complete
  await Promise.all(fetchPromises);
};
