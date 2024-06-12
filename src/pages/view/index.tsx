import styles from "./index.module.css";
import _ from "lodash";
import WithPlayheadMonitor from "components/framework/with-playhead-monitor";

import { useEffect, useState } from "react";
import { fetchEVAs, fetchTestEvents, getGraphsManifest } from "http-client/sequences";
import { getSgAudio, getTranscripts } from "http-client/emss-labs";
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
import { Collection, LoadingStatusEnum, SourceShortVal } from "utils/enums";
import {
  addVideos,
  setVideoLoadingStatus,
  fetchError as videosFetchError,
  clearVideos,
} from "store/videos";
import {
  addPhotos,
  setCollectionFilters,
  setPhotoLoadingStatus,
  fetchError as photosFetchError,
  clearPhotos,
} from "store/photos";
import { buildPhotoCollections, buildPhotoStore, buildVideoStore } from "http-client/media";
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
import { useDispatch, useSelector } from "react-redux";
import {
  allPanes,
  initialState as initialFrameworkState,
  setAllFrameworkState,
} from "store/framework";
import { interpretFramestateQueryString } from "utils/share-state";
import { Source } from "utils/enums";
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
import { pulseEvent, pulseLogInfo } from "utils/pulseAnalytics";
import { generateShareURL } from "utils/share-state";
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

export function V2() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState: QueryParams = getURLParams(searchParams);

  const framework = useSelector((state: RootState) => state.framework);
  const emssVideoEnabled = useSelector((state: RootState) => state.framework.emssVideoEnabled);
  const playhead = useSelector((state: RootState) => state.playhead);
  const playheadDate = playhead.date;
  const source = useSelector((state: RootState) => state.framework.source);
  const sequences = useSelector((state: RootState) => state.sequences);
  let allEVAs = sequences.allSequences;

  const [helpLoaderOpen, setHelpLoaderOpen] = useState(true);

  const dispatch = useDispatch();

  const retrieverRetryRange = [3000, 8000]; // in milliseconds

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
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();

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
      if (urlState.frameworkState.source === Source.NBL) {
        // Show only NBL sequences
        allEVAs = allEVAs.filter((eva) => eva.displayTitle.includes("NBL"));
      } else if (urlState.frameworkState.source === Source.TEST_EVENTS) {
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
  const populateSequenceStore = (collection) => {
    (async () => {
      if (collection === Collection.ARTEMIS) {
        dispatch(setSequenceLoadingStatus(LoadingStatusEnum.UNNEEDED));
        return;
      }
      dispatch(setSequenceLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        // EVA data from the wiki (either actual EVAs, or test events that look like EVAs)

        const updatedEVAsResponse =
          collection === Collection.ISS ? await fetchEVAs() : await fetchTestEvents();

        // retry in retrieverRetryRange seconds if we get a retrieverStatus of "inprogress"
        if (updatedEVAsResponse.responseMetadata.retrieverStatus === "inprogress") {
          setTimeout(
            () => {
              populateSequenceStore(collection);
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
          dispatch(setMaestroLoadingStatus(LoadingStatusEnum.LOADED));
        } else {
          dispatch(setMaestroLoadingStatus(LoadingStatusEnum.UNNEEDED));
        }
      } catch (e) {
        dispatch(sequencesFetchError(e.toString()));
      }
      dispatch(setSequenceLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  /** Update the video store */
  const populateVideoStore = (year, month, day, collection, incremental: boolean) => {
    (async () => {
      if (!incremental) {
        // Don't cause the app to show the loader if we're just updating the videos list
        dispatch(setVideoLoadingStatus(LoadingStatusEnum.LOADING));
      }
      try {
        // video data for this EVA
        const videoStoreResponse = await buildVideoStore(
          year,
          month,
          day,
          collection,
          emssVideoEnabled
        );
        // retry in retrieverRetryRange seconds if we get a retrieverStatus of "inprogress"
        if (videoStoreResponse.responseMetadata.retrieverStatus === "inprogress") {
          setTimeout(
            () => {
              populateVideoStore(year, month, day, collection, incremental);
            },
            _.random(retrieverRetryRange[0], retrieverRetryRange[1])
          );
          if (videoStoreResponse.data) dispatch(addVideos(videoStoreResponse));
          return;
        }
        dispatch(addVideos(videoStoreResponse));
      } catch (e) {
        dispatch(videosFetchError(e.toString()));
      }
      dispatch(setVideoLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  /** Update the photo store */
  const populatePhotoStore = (year, month, day, collection) => {
    (async () => {
      dispatch(setPhotoLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        // photos data for today
        const photoStoreResponse = await buildPhotoStore(year, month, day, collection);
        // retry in retrieverRetryRange seconds if we get a retrieverStatus of "inprogress"
        if (photoStoreResponse.responseMetadata.retrieverStatus === "inprogress") {
          setTimeout(
            () => {
              populatePhotoStore(year, month, day, collection);
            },
            _.random(retrieverRetryRange[0], retrieverRetryRange[1])
          );
          if (photoStoreResponse.data) dispatch(addPhotos(photoStoreResponse));
          return;
        }
        dispatch(addPhotos(photoStoreResponse));
        const photoCollectionsFilter = buildPhotoCollections(photoStoreResponse.data);
        dispatch(setCollectionFilters(photoCollectionsFilter));
      } catch (e) {
        dispatch(photosFetchError(e.toString()));
      }
      dispatch(setPhotoLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  /** Update the ephemeris store */
  const populateEphemerisStore = (year, month, day, collection) => {
    (async () => {
      if (collection !== Collection.ISS) {
        dispatch(setEphemeraLoadingStatus(LoadingStatusEnum.UNNEEDED));
        return;
      }
      dispatch(setEphemeraLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        const ephemerisStoreResponse = await buildEphemerisStore(year, month, day);
        // retry in retrieverRetryRange seconds if we get a retrieverStatus of "inprogress"
        if (ephemerisStoreResponse.responseMetadata.retrieverStatus === "inprogress") {
          setTimeout(
            () => {
              populateEphemerisStore(year, month, day, collection);
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
      dispatch(setEphemeraLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  /** Update the day night store */
  const populateDayNightStore = (year, month, day, collection) => {
    (async () => {
      if (collection !== Collection.ISS) {
        dispatch(setDayNightLoadingStatus(LoadingStatusEnum.UNNEEDED));
        return;
      }
      dispatch(setDayNightLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        const daynightStoreResponse = await buildDayNightStore(year, month, day);
        // retry in retrieverRetryRange seconds if we get a retrieverStatus of "inprogress"
        if (daynightStoreResponse.responseMetadata.retrieverStatus === "inprogress") {
          setTimeout(
            () => {
              populateDayNightStore(year, month, day, collection);
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
      dispatch(setDayNightLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  const populateGPSStore = (year, month, day, collection) => {
    (async () => {
      if (collection !== Collection.TEST_EVENTS) {
        dispatch(setGpsLoadingStatus(LoadingStatusEnum.UNNEEDED));
        return;
      }
      const gpsTracksResponse = await getGPSTracks(year, month, day);
      dispatch(setGPSTracks(gpsTracksResponse));
      dispatch(setGpsLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  const populateTranscriptStore = (source, year, month, day) => {
    (async () => {
      if (source === Source.NBL) {
        dispatch(setTranscriptLoadingStatus(LoadingStatusEnum.UNNEEDED));
        return;
      }
      dispatch(setTranscriptLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        const transcriptResponse = await getTranscripts(source, year, month, day);
        // retry in retrieverRetryRange seconds if we get a retrieverStatus of "inprogress"
        if (transcriptResponse.responseMetadata.retrieverStatus === "inprogress") {
          setTimeout(
            () => {
              populateTranscriptStore(source, year, month, day);
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
      dispatch(setTranscriptLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  const populateSgAudioStore = (source, year, month, day) => {
    (async () => {
      dispatch(setSgAudioLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        const sgAudioResponse = await getSgAudio(source, year, month, day);
        // retry in retrieverRetryRange seconds if we get a retrieverStatus of "inprogress"
        if (sgAudioResponse.responseMetadata.retrieverStatus === "inprogress") {
          setTimeout(
            () => {
              populateSgAudioStore(source, year, month, day);
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
      dispatch(setSgAudioLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  const populateGraphStore = (year, month, day) => {
    (async () => {
      dispatch(setGraphsLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        const graphResponse = await getGraphsManifest(source, year, month, day);
        // retry in retrieverRetryRange seconds if we get a retrieverStatus of "inprogress"
        if (graphResponse.responseMetadata.retrieverStatus === "inprogress") {
          setTimeout(
            () => {
              populateGraphStore(year, month, day);
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
      dispatch(setGraphsLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  // populate store when date or source change
  useEffect(() => {
    if (_.isNull(playheadDate) || _.isNull(source)) {
      return;
    }

    pulseEvent(source);
    pulseLogInfo(generateShareURL(framework, playhead));

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
    populateSequenceStore(Collection[source]);
    populateVideoStore(year, month, day, Collection[source], false);
    populatePhotoStore(year, month, day, Collection[source]);
    populateEphemerisStore(year, month, day, Collection[source]);
    populateDayNightStore(year, month, day, Collection[source]);
    populateGPSStore(year, month, day, Collection[source]);
    populateTranscriptStore(source, year, month, day);
    populateSgAudioStore(source, year, month, day);
    populateGraphStore(year, month, day);
  }, [playheadDate, source]);

  // re-populate the video store when emssVideoEnabled changes
  useEffect(() => {
    if (_.isNull(playheadDate) || _.isNull(source)) {
      return;
    }
    // populate stores
    populateVideoStore(year, month, day, Collection[source], true);
  }, [emssVideoEnabled]);

  // if UTC yyyymmdd playhead date matches UTC today
  const isToday = d.toISOString().split("T")[0] === new Date().toISOString().split("T")[0];

  // re-poll endpoints every minute
  useInterval(() => {
    if (isToday) {
      populateVideoStore(year, month, day, Collection[source], true);
      populatePhotoStore(year, month, day, Collection[source]);
      populateTranscriptStore(source, year, month, day);
      populateSgAudioStore(source, year, month, day);
    }
  }, 60 * 1000);

  return (
    <div className={styles.main}>
      <title>CODA - {source}</title>
      <Header helpLoaderOpen={helpLoaderOpen} setHelpLoaderOpen={setHelpLoaderOpen} />
      <div className={styles.body}>
        <Viewer />
      </div>
      <Timeline collection={Collection[source]} />
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
    if (source === SourceShortVal.ISS) {
      fState.source = Source.ISS;
      fState.layout = "c";
    } else if (source === SourceShortVal.TEST_EVENTS) {
      fState.source = Source.TEST_EVENTS;
      // if we're looking at the test events, we need to change the ISS location frame to GPS location pane
      fState.frames = setGPSLocationFrame(fState, "5");
      // set the default layout to the standard without Event Info
      fState.layout = "c";
      if (_.isNil(date)) {
        // 2021-10-23 is a good representation of Test Events (D-RATS 2021)
        date = new Date(2021, 9, 23).toISOString().split("T")[0]; // 9 = October
      }
    } else if (source === SourceShortVal.NBL) {
      fState.source = Source.NBL;
      // set the default layout to show no map, only All Photos along the bottom
      fState.layout = "e";
      if (_.isNil(date)) {
        // 2021-10-28 is a good representation of NBL events
        date = new Date(2021, 9, 28).toISOString().split("T")[0]; // 9 = October
      }
    } else if (source === SourceShortVal.ARTEMIS) {
      fState.source = Source.ARTEMIS;
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

function setNonDLVideoFrame(fState, frameNum, nonDLVideo) {
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

function setDLVideoFrame(fState, frameNum, downlink) {
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

function setGPSLocationFrame(fState, frameNum) {
  const frameStateData = {
    ...fState.frames[frameNum],
    paneType: "gps_location",
    paneStateData: {
      ...allPanes["gps_location"].defaultPaneStateData,
    },
  };
  return { ...fState.frames, [frameNum]: frameStateData };
}
