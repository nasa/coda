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
import { setPcdAudioData, clearPcdAudioData } from "store/pcdAudio";
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

  // Handle Socket.IO connection lifecycle.
  // The setTimeout(0) below is solely to work around a local-dev Firefox bug where date changes cause socket reconnects to hang; see comment block below for details.
  // Socket creation is deferred with setTimeout(0) so that React StrictMode's
  // synchronous mount→unmount→remount cycle never opens a WebSocket connection
  // during the first (discarded) mount. Without this, Firefox leaves the aborted
  // first connection in a half-closed state that blocks subsequent attempts.
  useEffect(() => {
    if (!user || !source || !playheadDate) return;

    const socketUrl = window.location.origin;

    const timerId = setTimeout(() => {
      if (socket.current && !socket.current.connected) {
        socket.current.removeAllListeners();
        socket.current = null;
      }

      if (!socket.current) {
        socket.current = io(socketUrl, {
          transports: ["websocket"],
          path: "/api/v1/socketio",
          reconnectionAttempts: socketUrl === "coda.fit.nasa.gov" ? Infinity : 10,
        });
      }

      const currentSocket = socket.current;

      currentSocket.on("connect", () => {
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
        if (!isDataTypeValidForSource(source, "pcdAudio")) {
          dispatch(clearPcdAudioData());
        }
      });

      currentSocket.on("disconnect", () => {
        setSocketStatus({
          connectionStatus: "disconnected",
          lastStatusFromServer: socketStatus.lastStatusFromServer,
          clientVersion: socketStatus.clientVersion,
        });
      });
      currentSocket.io.on("reconnect_attempt", () => {});
      currentSocket.io.on("reconnect", () => {
        setSocketStatus({
          connectionStatus: "connected",
          lastStatusFromServer: socketStatus.lastStatusFromServer,
          clientVersion: socketStatus.clientVersion,
        });
      });

      // For non-production environments. In production we will attempt reconnects infinitely
      currentSocket.io.on("reconnect_failed", () => {
        console.error("Socket reconnection failed after maximum attempts.");
      });

      // Incoming version number
      currentSocket.on("version", (appVersion: AppVersion) => {
        if (!isEqual(appVersion, socketStatus.clientVersion)) {
          if (socketStatus.clientVersion?.version) {
            alert(
              `A new version of CODA is available. Please refresh your browser to get the latest version. \nCurrent version: ${socketStatus.clientVersion.version}/${socketStatus.clientVersion.gitCommit}\nNew version: ${appVersion.version}/${appVersion.gitCommit} `
            );
          }
        }
      });

      // Incoming client counts
      currentSocket.on("statusFromServer", (statusFromServer: StatusFromServer) => {
        setSocketStatus((currentStatus) => {
          const visitorCountChanged =
            currentStatus.lastStatusFromServer.visitorCount !== statusFromServer.visitorCount;
          const versionChanged = !isEqual(
            currentStatus.clientVersion,
            statusFromServer.serverVersion
          );
          const connectionChanged = currentStatus.connectionStatus !== "connected";

          if (!visitorCountChanged && !versionChanged && !connectionChanged) {
            return currentStatus;
          }

          return {
            connectionStatus: "connected",
            lastStatusFromServer: statusFromServer,
            clientVersion: versionChanged
              ? statusFromServer.serverVersion
              : currentStatus.clientVersion,
          };
        });
      });

      // Incoming data updates
      currentSocket.on("dataUpdate", (dataUpdate: DataUpdate) => {
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
        } else if (dataUpdate.type === "pcdAudio") {
          const dataResponse = response as FetchResponse<PcdAudioJson | null>;
          dispatch(setPcdAudioData(dataResponse));
        }
      });

      // Incoming incremental data updates (e.g., new audio files from talkybotS2sSocket)
      currentSocket.on("incrementalDataUpdate", (incrementalUpdate: IncrementalDataUpdate) => {
        if (incrementalUpdate.type === "talkybot") {
          // Server already converts to TbAudioFileConverted before emitting
          dispatch(upsertTalkybotAudioFile(incrementalUpdate.item as TbAudioFileConverted));
        }
      });

      // Incoming live video restriction updates (admin can disable live video per session)
      currentSocket.on("liveVideoRestrictionUpdate", (update: LiveVideoRestrictionUpdate) => {
        dispatch(setLiveVideoEnabled(!update.disabled));
      });
    }, 0);

    return () => {
      clearTimeout(timerId);
      if (socket.current) {
        socket.current.removeAllListeners();
        socket.current.disconnect();
        socket.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adding dispatch, setSocketStatus, socketStatus would cause infinite reconnection loops
  }, [user, playheadDate, source]);

  return <></>;
};

export default SocketClient;
