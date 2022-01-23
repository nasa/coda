import Head from "next/head";
import Header from "components/interface/header";
import Viewer from "components/framework/frames";
import styles from "./index.module.css";
import _ from "lodash";
import Timeline from "components/interface/nav-timeline-v2";
import WithPlayheadMonitor from "components/framework/with-playhead-monitor";
import PlaybackControls from "components/interface/playback-controls";

import { useEffect } from "react";
import { fetchEVAs, fetchTestEvents, getGPSTracks } from "http-client/sequences";
import { RootState } from "store/index";
import { changeDate, changeTime, diff, isSameDate } from "store/playhead";
import {
  addSequences,
  fetchError as sequencesFetchError,
  setSequenceLoadingStatus,
} from "store/sequences";
import useInterval from "utils/useInterval";
import { Collection, LoadingStatusEnum } from "utils/enums";
import { addVideos, setVideoLoadingStatus, fetchError as videosFetchError } from "store/videos";
import {
  addPhotos,
  setCollectionFilters,
  setPhotoLoadingStatus,
  fetchError as photosFetchError,
} from "store/photos";
import { buildPhotoCollections, buildPhotoStore, buildVideoStore } from "http-client/media";
import { gpsFetchError, setGpsLoadingStatus, setGPSTracks } from "store/gps";
import { buildEphemerisStore } from "http-client/location";
import {
  setEphemeraLoadingStatus,
  fetchError as ephemeraFetchError,
  addEphemera,
} from "store/ephemera";
import { useDispatch, useSelector } from "react-redux";

export function V2(props: { query: QueryParams }) {
  const FIVE_MINS_MS = 5 * 60 * 1000;
  const playheadDate = useSelector((state: RootState) => state.playhead.date);
  const selectedSource = useSelector((state: RootState) => state.framework.selectedSource);

  const dispatch = useDispatch();

  // make sure the application is running on the correct date
  let userDate = null;

  const yyyymmdd = /^\d{4}-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|3[01])$/;
  if (!_.isNull(props.query.date) && !_.isNull(props.query.date.match(yyyymmdd))) {
    // change the date if the user set the `date` query param
    userDate = new Date(props.query.date);
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
    // default the time to 00:00:00Z
    let userTime = 0;

    // change the time if the user set the `gmt` query param
    if (!_.isNull(props.query.gmt)) {
      const [hh, mm, ss = 0] = props.query.gmt.split(":").map(Number);
      userTime = hh * 3600 + mm * 60 + ss;
    }

    dispatch(changeTime(userTime));
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
  const populateVideoStore = (year, month, day, collection) => {
    (async () => {
      dispatch(setVideoLoadingStatus(LoadingStatusEnum.LOADING));
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
    (async () => {
      if (_.isNull(playheadDate) || _.isNull(selectedSource)) {
        return;
      }

      const d = new Date(playheadDate);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();

      // populate the sequence store
      populateSequenceStore(Collection[selectedSource]);

      // populate the video store
      populateVideoStore(year, month, day, Collection[selectedSource]);

      // populage the photo store
      populatePhotoStore(year, month, day, Collection[selectedSource]);

      // populate the ephemeris store
      populateEphemerisStore(year, month, day, Collection[selectedSource]);

      // populate GPS store
      populateGPSStore(year, month, day, Collection[selectedSource]);
    })();
  }, [playheadDate, selectedSource]);

  // look for new videos every 5 minutes if the user is looking at today's date
  useInterval(() => {
    const d = new Date(playheadDate);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    populateVideoStore(year, month, day, Collection[selectedSource]);
  }, FIVE_MINS_MS);

  return (
    <div className={styles.main}>
      <Head>
        <title>{process.env.NEXT_PUBLIC_TITLE}</title>
      </Head>
      <Header />
      <div className={styles.body}>
        <Viewer />
      </div>
      <Timeline collection={Collection[selectedSource]} />
      <PlaybackControls />
    </div>
  );
}

export default WithPlayheadMonitor(V2);

export async function getServerSideProps({ query }) {
  const date = query.date === undefined ? null : query.date;
  const gmt = query.gmt === undefined ? null : query.gmt;
  const video1 = query.video1 === undefined ? null : query.video1;
  const video2 = query.video2 === undefined ? null : query.video2;
  const nonDLvideo1 = query.nonDLvideo1 === undefined ? null : query.nonDLvideo1;
  const nonDLvideo2 = query.nonDLvideo2 === undefined ? null : query.nonDLvideo2;

  const queryParams = [
    "frameType1",
    "frameState1",
    "frameType2",
    "frameState2",
    "frameType3",
    "frameState3",
    "frameType4",
    "frameState4",
    "frameType5",
    "frameState5",
    "frameType6",
    "frameState6",
  ];

  // TODO: work on a system for new query params and translating old ones
  // maybe old one triggers a layout that is the same as the original?

  const queryValues = queryParams.map((qp) => _.get(query, qp, null)); // eslint-disable-line @typescript-eslint/no-unused-vars

  const returnVal: QueryParams = {
    gmt,
    date,
    video1,
    video2,
    nonDLvideo1,
    nonDLvideo2,
  };

  return {
    props: {
      query: returnVal,
    },
  };
}

export interface QueryParams {
  /** yyyy-mm-dd the user wants to view */
  date: string;
  /** UTC hh:mm the user wants to view */
  gmt: string;
  /** Downlink number the user wants to view in player 1 */
  video1: string;
  /** Downlink number the user wants to view in player 2 */
  video2: string;
  /** ID of the non-D/L video the user wants to view in player 1 */
  nonDLvideo1: string;
  /** ID of the non-D/L video the user wants to view in player 2 */
  nonDLvideo2: string;
}
