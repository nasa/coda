import { Dispatch, FunctionComponent, SetStateAction, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import _ from "lodash";

const SocketClient: FunctionComponent<{
  roomName: string;
  socketStatus: SocketStatus;
  setSocketStatus: Dispatch<SetStateAction<SocketStatus>>;
}> = ({ roomName, socketStatus, setSocketStatus }) => {
  //socket connection
  const socket = useRef<Socket<ServerToClientEvents, ClientToServerEvents>>(null);

  //Handle socketio events
  useEffect(() => {
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
        room: roomName,
      };
      socket.current.emit("visitorJoin", visitorData);

      console.log(
        `${new Date().toISOString()} Connected to socket.io server. Joining room: ${roomName} socketId: ${
          socket.current.id
        }`
      );
    });

    socket.current.on("disconnect", () => {
      console.log(`${new Date().toISOString()} Disconnected from socket.io server`);
      setSocketStatus({
        connectionStatus: "disconnected",
        lastStatusFromServer: socketStatus.lastStatusFromServer,
        clientVersion: socketStatus.clientVersion,
      });
    });
    socket.current.io.on("reconnect_attempt", () => {
      console.log(`${new Date().toISOString()} Attempting to reconnect to socket.io server`);
    });
    socket.current.io.on("reconnect", () => {
      console.log(`${new Date().toISOString()} Reconnected to socket.io server`);
      setSocketStatus({
        connectionStatus: "connected",
        lastStatusFromServer: socketStatus.lastStatusFromServer,
        clientVersion: socketStatus.clientVersion,
      });
    });

    // Incoming client counts
    socket.current.on("statusFromServer", (statusFromServer: StatusFromServer) => {
      console.log(
        `${new Date().toISOString()} Clients connected via sockets: ${statusFromServer?.viewers}`
      );
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
  }, [socket]);

  return <></>;
};

export default SocketClient;
