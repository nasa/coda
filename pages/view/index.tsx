import Head from "next/head";
import Header from "components/interface/header";
import styles from "./index.module.css";
import _, { isNil } from "lodash";
import WithPlayheadMonitor from "components/framework/with-playhead-monitor";
import PlaybackControls from "components/interface/playback-controls";

import { useEffect, useState } from "react";
import { fetchEVAs, fetchTestEvents, getGPSTracks } from "http-client/sequences";
import { RootState } from "store/index";
import { changeDate, changeTime, diff, isSameDate } from "store/playhead";
import {
  addSequences,
  clearSequences,
  fetchError as sequencesFetchError,
  idFromDate,
  sequencesSelector,
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
import { clearGPSTracks, gpsFetchError, setGpsLoadingStatus, setGPSTracks } from "store/gps";
import { buildEphemerisStore } from "http-client/location";
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

/** Dynamically import the nav timeline because paper doesn't like Node  */
import dynamic from "next/dynamic";
const Timeline = dynamic(import("components/interface/nav-timeline"), {
  ssr: false,
});
/** Dynamically import the whole framework because nothing likes NextJS */
const Viewer = dynamic(import("components/framework/frames"), {
  ssr: false,
});

export function V2(props: { urlState }) {
  const FIVE_MINS_MS = 5 * 60 * 1000;
  const playhead = useSelector((state: RootState) => state.playhead);
  const playheadDate = playhead.date;
  const source = useSelector((state: RootState) => state.framework.source);
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  let allEVAs = sequencesSelector.selectAll(sequences);

  const [helpLoaderOpen, setHelpLoaderOpen] = useState(true);

  const dispatch = useDispatch();

  // make sure the application is running on the correct date
  let userDate = null;

  const yyyymmdd = /^\d{4}-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|3[01])$/;
  if (!_.isNull(props.urlState.date) && !_.isNull(props.urlState.date.match(yyyymmdd))) {
    // change the date if the user set the `date` query param
    userDate = new Date(props.urlState.date);
  } else {
    // default the date to today
    userDate = new Date();
  }

  // we will ignore the datetime if it is in the future! (CODA doesn't have precogs yet!)
  // https://youtu.be/m_0s8IZWkBg
  const isFutureDate = diff(userDate, new Date()) > 0;

  // we will ignore the datetime if it is invalid
  const isMalformedDate = isNaN(userDate.valueOf());

  if (isFutureDate || isMalformedDate) {
    // set the date today
    const d = new Date();
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    userDate = new Date(Date.UTC(year, month, day));
  }
  useEffect(() => {
    if (!playheadDate || !isSameDate(new Date(playheadDate), userDate)) {
      dispatch(changeDate(userDate.toISOString()));
    }
  }, []);

  useEffect(() => {
    // make sure the application is running on the correct time
    // default the time to 08:00:00Z
    let userTime = 8 * 60 * 60;

    const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d:[0-9]\d))$/; // matches valid hh:mm:ss times
    // change the time if the user set the `gmt` query param and it's in a valid format
    if (!_.isNull(props.urlState.gmt) && !isNil(props.urlState.gmt.match(reHHMM))) {
      const [hh, mm, ss = 0] = props.urlState.gmt.split(":").map(Number);
      userTime = hh * 3600 + mm * 60 + ss;
    } else {
      // change the time if the sequence has a PET start time
      const sequence = allEVAs.find((eva) => eva.startDate === idFromDate(playhead.date));
      let evaStartSec = null as number;
      const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d))$/; // matches valid hh:mm times
      if (!isNil(sequence) && !isNil(sequence.startTime.match(reHHMM))) {
        const [hh, mm] = sequence.startTime.split(":");
        evaStartSec = 3600 * +hh + 60 * +mm;
        userTime = evaStartSec;
      }
    }

    dispatch(changeTime(userTime));
  }, [sequences]);

  useEffect(() => {
    // set the framework state if that object was set in getServerSideProps
    if (!_.isNull(props.urlState.frameworkState)) {
      dispatch(setAllFrameworkState(props.urlState.frameworkState));
    }
  }, []);

  /** Update the EVA store */
  const populateSequenceStore = (collection) => {
    (async () => {
      dispatch(setSequenceLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        // EVA data from the wiki (either actual EVAs, or test events that look like EVAs)

        const updatedEVAsResponse =
          collection === Collection.ISS ? await fetchEVAs() : await fetchTestEvents();
        if (updatedEVAsResponse.cacheMetadata.error === undefined) {
          dispatch(addSequences(updatedEVAsResponse));
        } else {
          dispatch(sequencesFetchError(updatedEVAsResponse.cacheMetadata.error));
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
        const videoStoreResponse = await buildVideoStore(year, month, day, collection);
        if (videoStoreResponse.cacheMetadata.error === undefined) {
          dispatch(addVideos(videoStoreResponse));
        } else {
          dispatch(videosFetchError(videoStoreResponse.cacheMetadata.error));
        }
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
        if (photoStoreResponse.cacheMetadata.error === undefined) {
          dispatch(addPhotos(photoStoreResponse));
          const photoCollectionsFilter = buildPhotoCollections(photoStoreResponse.data);
          dispatch(setCollectionFilters(photoCollectionsFilter));
        } else {
          dispatch(photosFetchError(photoStoreResponse.cacheMetadata.error));
        }
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
        if (ephemerisStoreResponse.cacheMetadata.error === undefined) {
          dispatch(addEphemera(ephemerisStoreResponse));
        } else {
          dispatch(ephemeraFetchError(ephemerisStoreResponse.cacheMetadata.error));
        }
      } catch (e) {
        dispatch(ephemeraFetchError(e.toString()));
      }
      dispatch(setEphemeraLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  const populateGPSStore = (year, month, day, collection) => {
    (async () => {
      if (collection !== Collection.TEST_EVENTS) {
        dispatch(setGpsLoadingStatus(LoadingStatusEnum.UNNEEDED));
        return;
      }

      dispatch(setGpsLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        const gpsTracksResponse = await getGPSTracks(year, month, day);
        if (gpsTracksResponse.cacheMetadata.error === undefined) {
          dispatch(setGPSTracks(gpsTracksResponse));
        } else {
          dispatch(ephemeraFetchError(gpsTracksResponse.cacheMetadata.error));
        }
      } catch (e) {
        dispatch(gpsFetchError(e.toString()));
      }
      dispatch(setGpsLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  // populate store when date or source change
  useEffect(() => {
    if (_.isNull(playheadDate) || _.isNull(source)) {
      return;
    }

    const d = new Date(playheadDate);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    // open the about modal to show data loading
    setHelpLoaderOpen(true);

    // clear all stores
    dispatch(clearEphemera());
    dispatch(clearGPSTracks());
    dispatch(clearPhotos());
    dispatch(clearSequences());
    dispatch(clearVideos());

    // populate the sequence store
    populateSequenceStore(Collection[source]);

    // populate the video store
    populateVideoStore(year, month, day, Collection[source], false);

    // populage the photo store
    populatePhotoStore(year, month, day, Collection[source]);

    // populate the ephemeris store
    populateEphemerisStore(year, month, day, Collection[source]);

    // populate GPS store
    populateGPSStore(year, month, day, Collection[source]);
  }, [playheadDate, source]);

  // look for new videos every 5 minutes if the user is looking at today's date
  useInterval(() => {
    const d = new Date(playheadDate);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    populateVideoStore(year, month, day, Collection[source], true);
  }, FIVE_MINS_MS);

  return (
    <div className={styles.main}>
      <Head>
        <title>{process.env.NEXT_PUBLIC_TITLE}</title>
      </Head>
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

export async function getServerSideProps({ query }) {
  const version = query.v === undefined ? "1.0" : query.v; //version of share URL being received
  const date = query.date === undefined ? null : query.date;
  const gmt = query.gmt === undefined ? null : query.gmt;
  const source = query.s === undefined ? null : parseInt(query.s);
  const layout = query.l === undefined ? null : query.l;

  let fState: FrameworkState = { ...initialFrameworkState };
  if (source) {
    if (source === SourceShortVal.ISS) {
      fState.source = Source.ISS;
    } else if (source === SourceShortVal.TEST_EVENTS) {
      fState.source = Source.TEST_EVENTS;
    } else if (source === SourceShortVal.NBL) {
      fState.source = Source.NBL;
    }

    if (fState.source === Source.TEST_EVENTS) {
      // if we're looking at the test events, we need to change the ISS location frame to GPS location pane
      fState.frames = setGPSLocationFrame(fState, "5");
    }
  }
  if (layout) {
    fState.layout = layout;
  }

  // set default panes depending on source
  // if the source is not ISS, make the default downlink pane a non-downlink pain
  if (fState.source === Source.NBL || fState.source === Source.TEST_EVENTS) {
    fState.frames = setNonDLVideoFrame(fState, "1", "");
  }

  // if pane state data was passed in the query string, use it
  // Legacy support for old URLs
  if (version === "1.0") {
    const video1 = query.video1 === undefined ? null : query.video1;
    const video2 = query.video2 === undefined ? null : query.video2;
    const nonDLvideo1 = query.nonDLvideo1 === undefined ? null : query.nonDLvideo1;
    const nonDLvideo2 = query.nonDLvideo2 === undefined ? null : query.nonDLvideo2;

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

  return {
    props: {
      urlState: {
        date,
        gmt,
        frameworkState: fState,
      },
    },
  };
}

function setNonDLVideoFrame(fState, frameNum, nonDLVideo) {
  const muted = frameNum === "1" ? false : true;
  const frameStateData = {
    ...fState.frames[frameNum],
    paneType: "video_non_downlink",
    paneStateData: {
      ...allPanes["video_non_downlink"].defaultPaneStateData,
      downlink: -1,
      activeVideoFileID: nonDLVideo,
      muted,
    },
  };
  return { ...fState.frames, [frameNum]: frameStateData };
}

function setDLVideoFrame(fState, frameNum, downlink) {
  const muted = frameNum === "1" ? false : true;
  const frameStateData = {
    ...fState.frames[frameNum],
    paneType: "video_downlink",
    paneStateData: {
      ...allPanes["video_downlink"].defaultPaneStateData,
      downlink: parseInt(downlink) - 1,
      muted,
    },
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
