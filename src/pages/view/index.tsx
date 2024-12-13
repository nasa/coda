import styles from "./index.module.css";
import _ from "lodash";
import WithPlayheadMonitor from "components/framework/with-playhead-monitor";

import { useEffect, useState } from "react";
import { fetchEVAs, fetchTestEvents, getGraphsManifest } from "http-client/sequences";
import { getSgAudio, getTranscripts } from "http-client/emss";
import { RootState } from "store/index";
import { changeDate, changeTime } from "store/playhead";
import {
  addSequences,
  clearSequences,
  fetchError as sequencesFetchError,
  idFromDate,
  setSequenceLoadingStatus,
} from "store/sequences";
import useInterval from "utils/useInterval";
import { sourceShortVal } from "utils/consts";
import {
  addVideos,
  setVideoLoadingStatus,
  fetchError as videosFetchError,
  clearVideos,
  setMtxPlaybackAvailability,
  setMtxHlsEndpointNames,
} from "store/videos";
import {
  addPhotos,
  setCollectionFilters,
  setPhotoLoadingStatus,
  fetchError as photosFetchError,
  clearPhotos,
} from "store/photos";
import {
  buildMTXPlaybackStore,
  buildPhotoCollections,
  buildPhotoStore,
  buildVideoStore,
} from "http-client/media";
import { clearGPSTracks, setGpsLoadingStatus, setGPSTracks } from "store/gps";
import { buildEphemerisStore } from "http-client/location";
import {
  setTranscriptLoadingStatus,
  transcriptFetchError,
  setTranscripts,
  clearTranscripts,
} from "store/transcript";
import {
  setSgAudioActivity,
  setSgAudioLoadingStatus,
  sgAudioFetchError,
  clearSgAudioActivity,
} from "store/sg-audio";
import {
  setEphemeraLoadingStatus,
  fetchError as ephemeraFetchError,
  addEphemera,
  clearEphemera,
} from "store/ephemera";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import {
  allPanes,
  initialState as initialFrameworkState,
  setAllFrameworkState,
} from "store/framework";
import { interpretFramestateQueryString } from "utils/share-state";
import {
  setDayNightLoadingStatus,
  fetchError as daynightFetchError,
  addDayNight,
  clearDayNight,
} from "store/daynight";
import { buildDayNightStore } from "http-client/daynight";
import {
  clearGraphsManifest,
  graphsFetchError,
  setGraphsLoadingStatus,
  setGraphsManifest,
} from "store/graphs";
import { getMaestroExecuteTimelineStatus } from "http-client/maestro";
import { maestroFetchError, setMaestroData, setMaestroLoadingStatus } from "store/maestro";
import PlaybackControls from "components/interface/playback-controls";
import Header from "components/interface/header";
import Timeline from "components/interface/nav-timeline";
import Viewer from "components/framework/frames";
import { useSearchParams } from "react-router-dom";
import { URLSearchParams } from "url";
import { getGPSTracks } from "http-client/db";
import { diff, isSameDate } from "../../utils/date";
import SocketClient from "components/framework/SocketClient";
import { padZeros } from "utils/formatting";

export function V2() {
  const [searchParams, _setSearchParams] = useSearchParams();
  const urlState: QueryParams = getURLParams(searchParams);

  const emssVideoEnabled = useAppSelector(
    (state: RootState) => state.framework.emssVideoEnabled,
    refEqual
  );
  const playhead = useAppSelector((state: RootState) => state.playhead, deepEqual);
  const playheadDate = playhead.date;
  const source = useAppSelector((state: RootState) => state.framework.source, refEqual);
  const sequences = useAppSelector((state: RootState) => state.sequences, deepEqual);
  let allEVAs = sequences.allSequences;
  const oldMtxPlaybackAvailability = useAppSelector(
    (state: RootState) => state.videos.mtxPlaybackAvailability,
    deepEqual
  );
  const oldMtxHlsEndpointNames = useAppSelector(
    (state: RootState) => state.videos.mtxHlsEndpointNames,
    deepEqual
  );

  const [helpLoaderOpen, setHelpLoaderOpen] = useState(true);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>({
    connectionStatus: "disconnected",
    lastStatusFromServer: {
      timestamp: 0,
      viewers: 0,
      version: "",
    },
    clientVersion: "",
  });

  const dispatch = useAppDispatch();

  const retrieverRetryRange = [2000, 8000]; // in milliseconds

  // make sure the application is running on the correct date
  let userDate = null;

  const yyyymmdd = /^\d{4}-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|3[01])$/;
  if (!_.isNull(urlState.date) && !_.isNull(urlState.date.match(yyyymmdd))) {
    // change the date if the user set the `date` query param
    userDate = new Date(urlState.date);
  } else {
    // default the date to today
    userDate = new Date();
  }

  // we will ignore the datetime if it is in the future! (CODA doesn't have precogs yet!)
  // https://youtu.be/m_0s8IZWkBg
  const isFutureDate = diff(userDate, new Date()) > 0;

  // we will ignore the datetime if it is invalid
  const isMalformedDate = isNaN(userDate.valueOf());

  const d = new Date(playheadDate);
  const dateWanted = d.toISOString().split("T")[0];

  if (isFutureDate || isMalformedDate) {
    // set the date today
    const today = new Date();
    userDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate())
    );
  }
  useEffect(() => {
    if (!playheadDate || !isSameDate(new Date(playheadDate), userDate)) {
      dispatch(changeDate(userDate.toISOString()));
    }
  }, []);

  useEffect(() => {
    // make sure the application is running on the correct time
    // default the time to 10:30:00Z
    let userTime = 10.5 * 60 * 60;

    const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d:[0-9]\d))$/; // matches valid hh:mm:ss times
    // change the time if the user set the `gmt` query param and it's in a valid format
    if (!_.isNil(urlState.gmt) && !_.isNil(urlState.gmt.match(reHHMM))) {
      const [hh, mm, ss = 0] = urlState.gmt.split(":").map(Number);
      userTime = hh * 3600 + mm * 60 + ss;
    } else {
      // change the time if the sequence has a PET start time
      if (urlState.frameworkState.source === "NBL") {
        // Show only NBL sequences
        allEVAs = allEVAs.filter((eva) => eva.displayTitle.includes("NBL"));
      } else if (urlState.frameworkState.source === "TEST_EVENTS") {
        // Filter out all NBL sequences
        allEVAs = allEVAs.filter((eva) => !eva.displayTitle.includes("NBL"));
      }
      const sequence = allEVAs.find((eva) => eva.startDate === idFromDate(playhead.date));
      let evaStartSec = null as number;
      const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d))$/; // matches valid hh:mm times
      if (!_.isNil(sequence) && !_.isNil(sequence.startTime.match(reHHMM))) {
        const [hh, mm] = sequence.startTime.split(":");
        evaStartSec = 3600 * +hh + 60 * +mm;
        userTime = evaStartSec;
      }
    }

    dispatch(changeTime(userTime));
  }, [sequences]);

  useEffect(() => {
    // set the framework state if that object was set in url query params
    if (!_.isNull(urlState.frameworkState)) {
      dispatch(setAllFrameworkState(urlState.frameworkState));
    }
  }, []);

  /** Update the EVA store */
  const populateSequenceStore = async ({ source }: { source: Source }) => {
    if (source === "ARTEMIS") {
      dispatch(setSequenceLoadingStatus("unneeded"));
      return;
    }
    dispatch(setSequenceLoadingStatus("loading"));
    try {
      // EVA data from the wiki (either actual EVAs, or test events that look like EVAs)

      const updatedEVAsResponse = source === "ISS" ? await fetchEVAs() : await fetchTestEvents();

      // retry in retrieverRetryRange seconds if we get a retrieverStatus of "inprogress"
      if (updatedEVAsResponse.responseMetadata.retrieverStatus === "inprogress") {
        setTimeout(
          async () => {
            await populateSequenceStore({ source });
          },
          _.random(retrieverRetryRange[0], retrieverRetryRange[1])
        );
        if (updatedEVAsResponse.data) dispatch(addSequences(updatedEVAsResponse));

        return;
      }

      dispatch(addSequences(updatedEVAsResponse));

      // check selected date's sequence for a maestro uuid and attempt to populate the maestro store with the results
      const seq = updatedEVAsResponse.data.find((seq) =>
        isSameDate(new Date(seq.startDate), new Date(playhead.date))
      );
      if (seq && seq.maestroEventUuid) {
        const maestroResponse = await getMaestroExecuteTimelineStatus(seq.maestroEventUuid);
        if (!maestroResponse.responseMetadata.error) {
          dispatch(setMaestroData({ maestroInternalAPIData: maestroResponse.data }));
        } else {
          dispatch(maestroFetchError(maestroResponse.responseMetadata.error));
        }
        dispatch(setMaestroLoadingStatus("loaded"));
      } else {
        dispatch(setMaestroLoadingStatus("unneeded"));
      }
    } catch (e) {
      dispatch(sequencesFetchError(e.toString()));
    }
    dispatch(setSequenceLoadingStatus("loaded"));
  };
  const populateVideoStore = async ({
    dateWanted,
    source,
    incremental,
  }: {
    dateWanted: string;
    source: Source;
    incremental: boolean;
  }) => {
    if (!incremental) {
      dispatch(setVideoLoadingStatus("loading"));
    }
    try {
      const videoStoreResponse = await buildVideoStore(dateWanted, source, emssVideoEnabled);
      if (videoStoreResponse.responseMetadata.retrieverStatus === "inprogress") {
        setTimeout(
          async () => {
            await populateVideoStore({
              dateWanted,
              source,
              incremental,
            });
          },
          _.random(retrieverRetryRange[0], retrieverRetryRange[1])
        );
        if (videoStoreResponse.data) dispatch(addVideos(videoStoreResponse));
        return;
      }
      if (videoStoreResponse.responseMetadata.retrieverStatus === "error") {
        dispatch(videosFetchError(videoStoreResponse.responseMetadata.error));
        return;
      }
      if (videoStoreResponse.data) dispatch(addVideos(videoStoreResponse));
    } catch (e) {
      dispatch(videosFetchError(e.toString()));
    }
    dispatch(setVideoLoadingStatus("loaded"));
  };

  const populateMTXVideoStore = async ({
    dateWanted,
    source,
  }: {
    dateWanted: string;
    source: Source;
  }) => {
    // if dateWanted in the past 24 hours, populate the MTX video store
    const d = new Date(dateWanted);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff > 0 && diff < 48 * 60 * 60 * 1000) {
      try {
        const response = await buildMTXPlaybackStore({ dateWanted, source });
        if (response.responseMetadata.retrieverStatus === "inprogress") {
          setTimeout(
            async () => {
              console.log("setting timeout");
              await populateMTXVideoStore({ dateWanted, source });
            },
            _.random(retrieverRetryRange[0], retrieverRetryRange[1])
          );
          if (response.data) {
            dispatch(setMtxPlaybackAvailability(response.data.mtxPlaybackAvailability));
            dispatch(setMtxHlsEndpointNames(response.data.mtxHlsEndpointNames));
          }
          return;
        }
        if (response.responseMetadata.retrieverStatus === "error") {
          dispatch(photosFetchError(response.responseMetadata.error));
          return;
        }
        if (response.data) {
          // deep diff the response data to see if we need to update the store.
          // we do this because the API call can sometimes be "inprogress" for a long time and each timeout refresh causes the video panes to reload
          const diff =
            _.isEqual(oldMtxPlaybackAvailability, response.data.mtxPlaybackAvailability) &&
            _.isEqual(oldMtxHlsEndpointNames, response.data.mtxHlsEndpointNames);

          if (!diff) {
            dispatch(setMtxPlaybackAvailability(response.data.mtxPlaybackAvailability));
            dispatch(setMtxHlsEndpointNames(response.data.mtxHlsEndpointNames));
          }
        }
      } catch (e) {
        // ignore errors
      }
    }
  };

  const populatePhotoStore = async ({
    dateWanted,
    source,
  }: {
    dateWanted: string;
    source: Source;
  }) => {
    dispatch(setPhotoLoadingStatus("loading"));
    try {
      const photoStoreResponse = await buildPhotoStore(dateWanted, source);
      if (photoStoreResponse.responseMetadata.retrieverStatus === "inprogress") {
        setTimeout(
          async () => {
            await populatePhotoStore({ dateWanted, source });
          },
          _.random(retrieverRetryRange[0], retrieverRetryRange[1])
        );
        if (photoStoreResponse.data) dispatch(addPhotos(photoStoreResponse));
        return;
      }
      if (photoStoreResponse.responseMetadata.retrieverStatus === "error") {
        dispatch(photosFetchError(photoStoreResponse.responseMetadata.error));
        return;
      }
      if (photoStoreResponse.data) dispatch(addPhotos(photoStoreResponse));
      const photoCollectionsFilter = buildPhotoCollections(photoStoreResponse.data);
      dispatch(setCollectionFilters(photoCollectionsFilter));
    } catch (e) {
      dispatch(photosFetchError(e.toString()));
    }
    dispatch(setPhotoLoadingStatus("loaded"));
  };

  const populateEphemerisStore = async ({
    dateWanted,
    source,
  }: {
    dateWanted: string;
    source: Source;
  }) => {
    if (source !== "ISS") {
      dispatch(setEphemeraLoadingStatus("unneeded"));
      return;
    }
    dispatch(setEphemeraLoadingStatus("loading"));
    try {
      const ephemerisStoreResponse = await buildEphemerisStore(dateWanted);
      if (ephemerisStoreResponse.responseMetadata.retrieverStatus === "inprogress") {
        setTimeout(
          async () => {
            await populateEphemerisStore({ dateWanted, source });
          },
          _.random(retrieverRetryRange[0], retrieverRetryRange[1])
        );
        if (ephemerisStoreResponse.data) dispatch(addEphemera(ephemerisStoreResponse));
        return;
      }
      dispatch(addEphemera(ephemerisStoreResponse));
    } catch (e) {
      dispatch(ephemeraFetchError(e.toString()));
    }
    dispatch(setEphemeraLoadingStatus("loaded"));
  };

  const populateDayNightStore = async ({
    dateWanted,
    source,
  }: {
    dateWanted: string;
    source: Source;
  }) => {
    if (source !== "ISS") {
      dispatch(setDayNightLoadingStatus("unneeded"));
      return;
    }
    dispatch(setDayNightLoadingStatus("loading"));
    try {
      const daynightStoreResponse = await buildDayNightStore(dateWanted);
      if (daynightStoreResponse.responseMetadata.retrieverStatus === "inprogress") {
        setTimeout(
          async () => {
            await populateDayNightStore({ dateWanted, source });
          },
          _.random(retrieverRetryRange[0], retrieverRetryRange[1])
        );
        if (daynightStoreResponse.data) dispatch(addDayNight(daynightStoreResponse));
        return;
      }
      dispatch(addDayNight(daynightStoreResponse));
    } catch (e) {
      dispatch(daynightFetchError(e.toString()));
    }
    dispatch(setDayNightLoadingStatus("loaded"));
  };

  const populateGPSStore = async ({
    dateWanted,
    source,
  }: {
    dateWanted: string;
    source: Source;
  }) => {
    if (source !== "TEST_EVENTS") {
      dispatch(setGpsLoadingStatus("unneeded"));
      return;
    }
    const gpsTracksResponse = await getGPSTracks(dateWanted);
    dispatch(setGPSTracks(gpsTracksResponse));
    dispatch(setGpsLoadingStatus("loaded"));
  };

  const populateTranscriptStore = async ({
    dateWanted,
    source,
  }: {
    dateWanted: string;
    source: Source;
  }) => {
    if (source === "NBL") {
      dispatch(setTranscriptLoadingStatus("unneeded"));
      return;
    }
    dispatch(setTranscriptLoadingStatus("loading"));
    try {
      const transcriptResponse = await getTranscripts(dateWanted, source);
      if (transcriptResponse.responseMetadata.retrieverStatus === "inprogress") {
        setTimeout(
          async () => {
            await populateTranscriptStore({ dateWanted, source });
          },
          _.random(retrieverRetryRange[0], retrieverRetryRange[1])
        );
        if (transcriptResponse.data) dispatch(setTranscripts(transcriptResponse));
        return;
      }
      dispatch(setTranscripts(transcriptResponse));
    } catch (e) {
      dispatch(transcriptFetchError(e.toString()));
    }
    dispatch(setTranscriptLoadingStatus("loaded"));
  };

  const populateSgAudioStore = async ({
    dateWanted,
    source,
  }: {
    dateWanted: string;
    source: Source;
  }) => {
    dispatch(setSgAudioLoadingStatus("loading"));
    try {
      const sgAudioResponse = await getSgAudio(dateWanted, source);
      if (sgAudioResponse.responseMetadata.retrieverStatus === "inprogress") {
        setTimeout(
          async () => {
            await populateSgAudioStore({ dateWanted, source });
          },
          _.random(retrieverRetryRange[0], retrieverRetryRange[1])
        );
        if (sgAudioResponse.data) dispatch(setSgAudioActivity(sgAudioResponse));
        return;
      }
      dispatch(setSgAudioActivity(sgAudioResponse));
    } catch (e) {
      dispatch(sgAudioFetchError(e.toString()));
    }
    dispatch(setSgAudioLoadingStatus("loaded"));
  };

  const populateGraphStore = async ({
    dateWanted,
    source,
  }: {
    dateWanted: string;
    source: Source;
  }) => {
    dispatch(setGraphsLoadingStatus("loading"));
    try {
      const graphResponse = await getGraphsManifest(dateWanted, source);
      if (graphResponse.responseMetadata.retrieverStatus === "inprogress") {
        setTimeout(
          async () => {
            await populateGraphStore({ dateWanted, source });
          },
          _.random(retrieverRetryRange[0], retrieverRetryRange[1])
        );
        if (graphResponse.data) dispatch(setGraphsManifest(graphResponse));
        return;
      }
      dispatch(setGraphsManifest(graphResponse));
    } catch (e) {
      dispatch(graphsFetchError(e.toString()));
    }
    dispatch(setGraphsLoadingStatus("loaded"));
  };

  // make path for socketio room
  const makeDateSourcePath = () => {
    const newPlayheadDate = urlState.date !== null ? urlState.date : new Date();
    const newPlayheadSource = urlState.frameworkState.source;
    const date = new Date(newPlayheadDate);
    return `${padZeros(date.getUTCDate(), 2)}-${padZeros(date.getUTCMonth() + 1, 2)}-${date.getUTCFullYear()}/${newPlayheadSource}`;
  };

  // populate store when date or source change
  useEffect(() => {
    if (_.isNull(playheadDate) || _.isNull(source)) {
      return;
    }

    // open the about modal to show data loading
    setHelpLoaderOpen(true);

    // clear all stores
    dispatch(clearEphemera());
    dispatch(clearDayNight());
    dispatch(clearGPSTracks());
    dispatch(clearPhotos());
    dispatch(clearSequences());
    dispatch(clearVideos());
    dispatch(clearTranscripts());
    dispatch(clearSgAudioActivity());
    dispatch(clearGraphsManifest());

    // populate stores
    (async () => {
      populateSequenceStore({ source });
      populateVideoStore({ dateWanted, source, incremental: false });
      populateMTXVideoStore({ dateWanted, source });
      populatePhotoStore({ dateWanted, source });
      populateEphemerisStore({ dateWanted, source });
      populateDayNightStore({ dateWanted, source });
      populateGPSStore({ dateWanted, source });
      populateTranscriptStore({ dateWanted, source });
      populateSgAudioStore({ dateWanted, source });
      populateGraphStore({ dateWanted, source });
    })();
  }, [playheadDate, source]);

  // re-populate the video store when emssVideoEnabled changes
  useEffect(() => {
    if (_.isNull(playheadDate) || _.isNull(source)) {
      return;
    }
    // populate stores
    populateVideoStore({ dateWanted, source, incremental: true });
  }, [emssVideoEnabled]);

  // if UTC yyyymmdd playhead date matches UTC today
  const isToday = isSameDate(new Date(), new Date(playheadDate));

  // re-poll endpoints every minute
  useInterval(async () => {
    if (isToday) {
      await populateVideoStore({ dateWanted, source, incremental: false });
      await populateMTXVideoStore({ dateWanted, source });
      await populatePhotoStore({ dateWanted, source });
      await populateTranscriptStore({ dateWanted, source });
      await populateSgAudioStore({ dateWanted, source });
    }
  }, 60 * 1000);

  return (
    <div className={styles.main}>
      <title>CODA - {source}</title>
      <Header
        helpLoaderOpen={helpLoaderOpen}
        setHelpLoaderOpen={setHelpLoaderOpen}
        socketStatus={socketStatus}
      />
      <SocketClient
        roomName={makeDateSourcePath()}
        socketStatus={socketStatus}
        setSocketStatus={setSocketStatus}
      />
      <div className={styles.body}>
        <Viewer />
      </div>
      <Timeline source={source} />
      <PlaybackControls />
    </div>
  );
}

export default WithPlayheadMonitor(V2);

function getURLParams(query: URLSearchParams): QueryParams {
  const version = query?.get("v") || "1.0"; //version of share URL being received
  let date = query?.get("date");
  let gmt = query?.get("gmt");
  const source = parseInt(query?.get("s"));
  const layout = query?.get("l");

  let fState: FrameworkState = { ...initialFrameworkState };
  if (source) {
    if (source === sourceShortVal.ISS) {
      fState.source = "ISS";
      fState.layout = "c";
    } else if (source === sourceShortVal.TEST_EVENTS) {
      fState.source = "TEST_EVENTS";
      // if we're looking at the test events, we need to change the ISS location frame to GPS location pane
      fState.frames = setGPSLocationFrame(fState, "5");
      // set the default layout to the standard without Event Info
      fState.layout = "c";
      if (_.isNil(date)) {
        // 2021-10-23 is a good representation of Test Events (D-RATS 2021)
        date = new Date(2021, 9, 23).toISOString().split("T")[0]; // 9 = October
      }
    } else if (source === sourceShortVal.NBL) {
      fState.source = "NBL";
      // set the default layout to show no map, only All Photos along the bottom
      fState.layout = "e";
      if (_.isNil(date)) {
        // 2021-10-28 is a good representation of NBL events
        date = new Date(2021, 9, 28).toISOString().split("T")[0]; // 9 = October
      }
    } else if (source === sourceShortVal.ARTEMIS) {
      fState.source = "ARTEMIS";
      // set the default layout to show no map, only All Photos along the bottom
      fState.layout = "e";
      if (_.isNil(date)) {
        // 2022-12-05 is a good representation of Artemis 1 events
        date = new Date(2022, 11, 5).toISOString().split("T")[0]; // 9 = October
      }
      if (_.isNil(gmt)) {
        // 2022-12-05 at 17:14:44 is a good representation of Artemis 1 events
        gmt = "17:14:44";
      }
    }
  }

  // Override default layouts with the one requested if it exists
  if (layout) {
    fState.layout = layout;
  }

  // if pane state data was passed in the query string, use it
  // Legacy support for old URLs
  if (version === "1.0") {
    const video1 = query?.get("video1");
    const video2 = query?.get("video2");
    const nonDLvideo1 = query?.get("nonDLvideo1");
    const nonDLvideo2 = query?.get("nonDLvideo2");

    if (nonDLvideo1) {
      fState.frames = setNonDLVideoFrame(fState, "1", nonDLvideo1);
    } else if (video1) {
      fState.frames = setDLVideoFrame(fState, "1", video1);
    }
    if (nonDLvideo2) {
      fState.frames = setNonDLVideoFrame(fState, "2", nonDLvideo2);
    } else if (video2) {
      fState.frames = setDLVideoFrame(fState, "2", video2);
    }
  } else if (version === "2.0") {
    fState.frames = interpretFramestateQueryString(query);
  }
  const urlState: QueryParams = {
    date,
    gmt,
    frameworkState: fState,
  };

  return urlState;
}

function setNonDLVideoFrame(fState: FrameworkState, frameNum: string, nonDLVideo: string) {
  const frameStateData = {
    ...fState.frames[frameNum],
    paneType: "video_non_downlink",
    paneStateData: {
      ...allPanes["video_non_downlink"].defaultPaneStateData,
      channel: -1,
      activeVideoFileID: nonDLVideo,
      muted: true,
    } as VideoPaneStateData,
  };
  return { ...fState.frames, [frameNum]: frameStateData };
}

function setDLVideoFrame(fState: FrameworkState, frameNum: string, downlink: string) {
  const frameStateData = {
    ...fState.frames[frameNum],
    paneType: "video_downlink",
    paneStateData: {
      ...allPanes["video_downlink"].defaultPaneStateData,
      channel: parseInt(downlink) - 1,
      muted: true,
    } as VideoPaneStateData,
  };
  return { ...fState.frames, [frameNum]: frameStateData };
}

function setGPSLocationFrame(fState: FrameworkState, frameNum: string) {
  const frameStateData = {
    ...fState.frames[frameNum],
    paneType: "gps_location",
    paneStateData: {
      ...allPanes["gps_location"].defaultPaneStateData,
    },
  };
  return { ...fState.frames, [frameNum]: frameStateData };
}
