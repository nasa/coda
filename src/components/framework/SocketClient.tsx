import isEqual from "lodash/isEqual";
import { setupFetchFns } from "packages/fetchFns";
import { getCurrentUser } from "packages/getCurrentUser";
import { Dispatch, FunctionComponent, SetStateAction, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { usePlayheadContext } from "store/contextProviders/playheadContext";
import { addDayNight, setDayNightLoadingStatus } from "store/daynight";
import { addEphemera, setEphemeraLoadingStatus } from "store/ephemera";
import { setGPSTracks, setGpsLoadingStatus } from "store/gps";
import { setGraphsLoadingStatus, setGraphsManifest } from "store/graphs";
import {
  addPhotos,
  buildPhotoCollections,
  setCollectionFilters,
  setPhotoLoadingStatus,
} from "store/photos";
import { addSequences, setSequenceLoadingStatus } from "store/sequences";
import { setSgAudioActivity, setSgAudioLoadingStatus } from "store/sg-audio";
import { setTranscriptLoadingStatus, setTranscripts } from "store/transcript";
import {
  addVideos,
  setMtxHlsEndpoints,
  setMtxPlaybackAvailability,
  setVideoLoadingStatus,
} from "store/videos";
import { useAppDispatch } from "utils/useAppDispatch";
import { refEqual, useAppSelector } from "utils/useAppSelector";

const SocketClient: FunctionComponent<{
  socketStatus: ClientSocketStatus;
  setSocketStatus: Dispatch<SetStateAction<ClientSocketStatus>>;
}> = ({ socketStatus, setSocketStatus }) => {
  const dispatch = useAppDispatch();
  const { playhead } = usePlayheadContext();

  const source = useAppSelector((state) => state.framework.source, refEqual);

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
    if (!user || !source || !playhead) return;

    // Create a socket connection
    if (!socket.current || (socket.current && !socket.current.connected)) {
      const socketUrl = window.location.origin;

      socket.current = io(socketUrl, {
        transports: ["websocket"],
        upgrade: true,
        path: "/api/v1/socketio",
        reconnectionAttempts: socketUrl === "coda.fit.nasa.gov" ? Infinity : 10,
      });
    }

    socket.current.on("connect", () => {
      const visitorData: VisitorData = {
        socketId: socket.current.id,
        dateViewing: playhead.date.split("T")[0],
        source: source,
        user: user,
        appVersion: socketStatus.clientVersion,
        connectedAt: Date.now(),
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

    // For non-production environments. In production we will attempt reconnects infinitely
    socket.current.io.on("reconnect_failed", () => {
      console.error("Socket reconnection failed after maximum attempts.");
    });

    // Incoming version number
    socket.current.on("version", (appVersion: AppVersion) => {
      if (!isEqual(appVersion, socketStatus.clientVersion)) {
        if (socketStatus.clientVersion?.version) {
          alert(
            `A new version of CODA is available. Please refresh your browser to get the latest version. \nCurrent version: ${socketStatus.clientVersion.version}/${socketStatus.clientVersion.gitCommit}\nNew version: ${appVersion.version}/${appVersion.gitCommit} `
          );
        }
      }
    });

    // Incoming client counts
    socket.current.on("statusFromServer", (statusFromServer: StatusFromServer) => {
      setSocketStatus({
        connectionStatus: "connected",
        lastStatusFromServer: statusFromServer,
        clientVersion: statusFromServer.serverVersion,
      });
    });

    // Incoming data updates
    socket.current.on("dataUpdate", (dataUpdate: DataUpdate) => {
      if (dataUpdate.type === "daynight") {
        dispatch(addDayNight(dataUpdate.wrappedResponse));
        dispatch(setDayNightLoadingStatus("loaded"));
      } else if (dataUpdate.type === "ephemeris") {
        dispatch(addEphemera(dataUpdate.wrappedResponse));
        dispatch(setEphemeraLoadingStatus("loaded"));
      } else if (dataUpdate.type === "videos") {
        dispatch(addVideos(dataUpdate.wrappedResponse));
        dispatch(setVideoLoadingStatus("loaded"));
      } else if (dataUpdate.type === "photos") {
        dispatch(addPhotos(dataUpdate.wrappedResponse));
        const photoCollectionsFilter = buildPhotoCollections(dataUpdate.wrappedResponse.data);
        dispatch(setCollectionFilters(photoCollectionsFilter));
        dispatch(setPhotoLoadingStatus("loaded"));
      } else if (dataUpdate.type === "wikiEvas") {
        //TODO: add maestro stuff
        dispatch(addSequences(dataUpdate.wrappedResponse));
        dispatch(setSequenceLoadingStatus("loaded"));
      } else if (dataUpdate.type === "wikiTestEvents") {
        //TODO: add maestro stuff
        dispatch(addSequences(dataUpdate.wrappedResponse));
        dispatch(setSequenceLoadingStatus("loaded"));
      } else if (dataUpdate.type === "mtxvideo") {
        dispatch(
          setMtxPlaybackAvailability(dataUpdate.wrappedResponse.data.mtxPlaybackAvailability)
        );
        dispatch(setMtxHlsEndpoints(dataUpdate.wrappedResponse.data.mtxHlsEndpoints));
      } else if (dataUpdate.type === "gpstracks") {
        dispatch(setGPSTracks(dataUpdate.wrappedResponse));
        dispatch(setGpsLoadingStatus("loaded"));
      } else if (dataUpdate.type === "transcript") {
        dispatch(setTranscripts(dataUpdate.wrappedResponse));
        dispatch(setTranscriptLoadingStatus("loaded"));
      } else if (dataUpdate.type === "sgaudio") {
        dispatch(setSgAudioActivity(dataUpdate.wrappedResponse));
        dispatch(setSgAudioLoadingStatus("loaded"));
      } else if (dataUpdate.type === "graph") {
        dispatch(setGraphsManifest(dataUpdate.wrappedResponse));
        dispatch(setGraphsLoadingStatus("loaded"));
      }
    });

    // Clean up the socket connection on unmount
    return () => {
      socket.current.off("connect");
      socket.current.off("disconnect");
      socket.current.io.off("reconnect_attempt");
      socket.current.io.off("reconnect");
      socket.current.io.off("reconnect_failed");
      socket.current.off("version");
      socket.current.off("statusFromServer");
      socket.current.off("dataUpdate");
      socket.current.disconnect();
    };
  }, [socket, user, playhead.date, source]);

  return <></>;
};

export default SocketClient;
