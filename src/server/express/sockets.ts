import packagejson from "../../../package.json";
import remove from "lodash/remove";
import find from "lodash/find";
import { globalValues } from "./global";

export const setupSocketIO = (): void => {
  // initialize the global object that will store the visitor tracking data and last edit events

  const visitorsData: VisitorData[] = globalValues.serverSocketStatus.visitorsData;

  let socketInterval: NodeJS.Timeout = null;

  const io = globalValues.socketio;

  // Listen for connection events
  io.on("connection", (socket: any) => {
    // emit app version to client that just connected
    socket.emit("version", packagejson.version || "unknown version");

    socket.on("visitorJoin", (visitorData: VisitorData) => {
      // join the room for the user's selected date
      socket.join(visitorData.room);

      // remove this socket from tracking list if it exists
      remove(visitorsData, (item) => {
        return item.socketId === visitorData.socketId;
      });
      visitorsData.push(visitorData);

      const statusFromServer = getStatusFromServer();

      // emit visitor count to all clients
      io.emit("statusFromServer", statusFromServer);
    });

    socket.on("connect", () => {});

    socket.on("disconnect", () => {
      const visitorBeingRemoved = find(visitorsData, {
        socketId: socket.id,
      });

      // remove this socket from the visitor tracking
      remove(visitorsData, (item) => {
        return item.socketId === visitorBeingRemoved.socketId;
      });
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
  });
};

export const getStatusFromServer = (): StatusFromServer => {
  const viewerCount = globalValues.serverSocketStatus.visitorsData?.length;
  return {
    viewers: viewerCount,
    timestamp: Date.now(),
    version: packagejson.version || "",
  };
};
