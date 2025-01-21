import { setupFetchFns } from "packages/fetchFns";
import { getCurrentUser } from "packages/getCurrentUser";
import { Dispatch, FunctionComponent, SetStateAction, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

const SocketClient: FunctionComponent<{
  socketStatus: SocketStatus;
  setSocketStatus: Dispatch<SetStateAction<SocketStatus>>;
}> = ({ socketStatus, setSocketStatus }) => {
  //socket connection
  const socket = useRef<Socket<ServerToClientEvents, ClientToServerEvents>>(null);

  const [user, setUser] = useState<EmssUser | undefined>(undefined);

  // Ensure the user is logged in and get the user data
  useEffect(() => {
    setupFetchFns();
    getCurrentUser().then((thisUser) => {
      if (user instanceof Error) {
        return;
      }
      setUser(thisUser as EmssUser);
    });
  }, []);

  //Handle socketio events
  useEffect(() => {
    if (!user) return;

    // Create a socket connection
    if (!socket.current || (socket.current && !socket.current.connected)) {
      const socketUrl = window.location.origin;

      socket.current = io(socketUrl, {
        transports: ["websocket"],
        upgrade: true,
        path: "/api/v1/socketio",
      });
    }

    socket.current.on("connect", () => {
      const visitorData: VisitorData = {
        socketId: socket.current.id,
        user: user,
      };
      socket.current.emit("visitorJoin", visitorData);
    });

    socket.current.on("disconnect", () => {
      setSocketStatus({
        connectionStatus: "disconnected",
        lastStatusFromServer: socketStatus.lastStatusFromServer,
        clientVersion: socketStatus.clientVersion,
      });
    });
    socket.current.io.on("reconnect_attempt", () => {});
    socket.current.io.on("reconnect", () => {
      setSocketStatus({
        connectionStatus: "connected",
        lastStatusFromServer: socketStatus.lastStatusFromServer,
        clientVersion: socketStatus.clientVersion,
      });
    });

    // Incoming client counts
    socket.current.on("statusFromServer", (statusFromServer: StatusFromServer) => {
      if (statusFromServer.version !== socketStatus.clientVersion && socketStatus.clientVersion) {
        alert("A new version of CODA is available. Please refresh your browser.");
      }
      setSocketStatus({
        connectionStatus: "connected",
        lastStatusFromServer: statusFromServer,
        clientVersion: statusFromServer.version,
      });
    });

    // Clean up the socket connection on unmount
    return () => {
      socket.current.off("connect");
      socket.current.off("disconnect");
      socket.current.io.off("reconnect_attempt");
      socket.current.io.off("reconnect");
      socket.current.off("statusFromServer");
      socket.current.disconnect();
    };
  }, [socket, user]);

  return <></>;
};

export default SocketClient;
