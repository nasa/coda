import isEqual from "lodash/isEqual";
import { setupFetchFns } from "packages/fetchFns";
import { getCurrentUser } from "packages/getCurrentUser";
import { Dispatch, FunctionComponent, SetStateAction, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { addDayNight } from "store/daynight";
import { addEphemera } from "store/ephemera";
import { setGPSTracks } from "store/gps";
import { setGraphsManifest } from "store/graphs";
import { addPhotos, buildPhotoCollections, setCollectionFilters } from "store/photos";
import { addSequences } from "store/sequences";
import { upsertTalkybotAudioFile, setTalkybotAudioFiles } from "store/talkybot";
import { setLiveVideoEnabled } from "store/user";
import { addVideos, setMtxPlayback } from "store/videos";
import { useAppDispatch } from "utils/useAppDispatch";
import { refEqual, useAppSelector } from "utils/useAppSelector";
import { isDataTypeValidForSource } from "utils/sourceDataTypeMap";
import { usePlayheadDate } from "store/hooks";

const SocketClient: FunctionComponent<{
  socketStatus: ClientSocketStatus;
  setSocketStatus: Dispatch<SetStateAction<ClientSocketStatus>>;
}> = ({ socketStatus, setSocketStatus }) => {
  const dispatch = useAppDispatch();
  const playheadDate = usePlayheadDate();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect to fetch current user
  }, []);

  //Handle socketio events
  useEffect(() => {
    if (!user || !source || !playheadDate) return;

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
      const currentSocket = socket.current!; // non-null assertion
      const visitorData: VisitorData = {
        socketId: currentSocket.id ?? "",
        dateViewing: playheadDate.split("T")[0],
        source: source,
        user: user,
        appVersion: socketStatus.clientVersion,
        connectedAt: Date.now(),
        liveVideoEnabled: true,
      };
      currentSocket.emit("visitorJoin", visitorData);

      // Set metadata to "unneeded" for data types not valid for this source
      const unneededMetadata: FetchMetadata = {
        success: true,
        timestamp: new Date().toISOString(),
        unneeded: true,
      };

      if (!isDataTypeValidForSource(source, "daynight")) {
        dispatch(addDayNight({ data: { dayNight: [] }, fetchMetadata: unneededMetadata }));
      }
      if (!isDataTypeValidForSource(source, "ephemeris")) {
        dispatch(addEphemera({ data: [], fetchMetadata: unneededMetadata }));
      }
      if (
        !isDataTypeValidForSource(source, "wikiEvas") &&
        !isDataTypeValidForSource(source, "wikiTestEvents")
      ) {
        dispatch(addSequences({ data: [], fetchMetadata: unneededMetadata }));
      }
      if (!isDataTypeValidForSource(source, "gpstracks")) {
        dispatch(setGPSTracks({ data: [], fetchMetadata: unneededMetadata }));
      }
      if (!isDataTypeValidForSource(source, "graph")) {
        dispatch(setGraphsManifest({ data: null, fetchMetadata: unneededMetadata }));
      }
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
      const { response } = dataUpdate;
      if (!response) return;

      if (dataUpdate.type === "daynight") {
        const dataResponse = response as FetchResponse<DayNightStore>;
        dispatch(addDayNight(dataResponse));
      } else if (dataUpdate.type === "ephemeris") {
        const dataResponse = response as FetchResponse<EphemerisEntry[]>;
        dispatch(addEphemera(dataResponse));
      } else if (dataUpdate.type === "videos") {
        const dataResponse = response as FetchResponse<VideoFile[]>;
        dispatch(addVideos(dataResponse));
      } else if (dataUpdate.type === "photos") {
        const dataResponse = response as FetchResponse<PhotoFile[]>;
        dispatch(addPhotos(dataResponse));
        const photoCollectionsFilter = buildPhotoCollections(dataResponse.data ?? []);
        dispatch(setCollectionFilters(photoCollectionsFilter));
      } else if (dataUpdate.type === "wikiEvas") {
        const dataResponse = response as FetchResponse<Sequence[]>;
        dispatch(addSequences(dataResponse));
      } else if (dataUpdate.type === "wikiTestEvents") {
        const dataResponse = response as FetchResponse<Sequence[]>;
        dispatch(addSequences(dataResponse));
      } else if (dataUpdate.type === "mtxvideo") {
        const dataResponse = response as FetchResponse<MTXApiResponses>;
        dispatch(setMtxPlayback(dataResponse));
      } else if (dataUpdate.type === "gpstracks") {
        const dataResponse = response as FetchResponse<GPSTrack[]>;
        dispatch(setGPSTracks(dataResponse));
      } else if (dataUpdate.type === "talkybot") {
        const dataResponse = response as FetchResponse<TbAudioFileConverted[]>;
        dispatch(setTalkybotAudioFiles(dataResponse));
      } else if (dataUpdate.type === "graph") {
        const dataResponse = response as FetchResponse<GraphsManifest>;
        dispatch(setGraphsManifest(dataResponse));
      }
    });

    // Incoming incremental data updates (e.g., new audio files from talkybotS2sSocket)
    socket.current.on("incrementalDataUpdate", (incrementalUpdate: IncrementalDataUpdate) => {
      if (incrementalUpdate.type === "talkybot") {
        // Server already converts to TbAudioFileConverted before emitting
        dispatch(upsertTalkybotAudioFile(incrementalUpdate.item as TbAudioFileConverted));
      }
    });

    // Incoming live video restriction updates (admin can disable live video per session)
    socket.current.on("liveVideoRestrictionUpdate", (update: LiveVideoRestrictionUpdate) => {
      dispatch(setLiveVideoEnabled(!update.disabled));
    });

    // Clean up the socket connection on unmount
    return () => {
      if (!socket.current) return;
      socket.current.off("connect");
      socket.current.off("disconnect");
      socket.current.io.off("reconnect_attempt");
      socket.current.io.off("reconnect");
      socket.current.io.off("reconnect_failed");
      socket.current.off("version");
      socket.current.off("statusFromServer");
      socket.current.off("dataUpdate");
      socket.current.off("incrementalDataUpdate");
      socket.current.off("liveVideoRestrictionUpdate");
      socket.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adding dispatch, setSocketStatus, socketStatus would cause infinite reconnection loops
  }, [socket, user, playheadDate, source]);

  return <></>;
};

export default SocketClient;
