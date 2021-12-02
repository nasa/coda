import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import PlaybackControls from "components/playback-controls";
import StatusBar from "components/status-bar";
import ISSLocation from "components/iss-location";
import TELocation from "components/te-location";
import Video from "components/video";
import Photos from "components/photos";
import WithPlayheadMonitor from "components/with-playhead-monitor";
import styles from "./main.module.css";
import type { QueryParams } from "pages/view/iss";
import { Collection } from "typings";
import { gpsFetchError, setGPSTracks } from "store/gps";
import { getGPSTracks } from "http-client/gps";

import isNull from "lodash/isNull";
import { useDispatch, useSelector } from "react-redux";
import { fetchEVAs, fetchTestEvents } from "http-client/sequences";
import { buildVideoStore, buildPhotoStore, buildPhotoCollections } from "http-client/media";
import { buildEphemerisStore } from "http-client/location";
import {
  addVideos,
  haveVideosFromDate,
  fetchError as videosFetchError,
  videoSelectors,
  VideosEntityState,
} from "store/videos";
import {
  addPhotos,
  photosSelectors,
  fetchError as photosFetchError,
  setCollectionFilters,
  PhotosEntityState,
} from "store/photos";
import { addSequences, fetchError as sequencesFetchError } from "store/sequences";
import { addEphemera, fetchError as ephemeraFetchError } from "store/ephemera";
import { useEffect } from "react";
import { diff, isSameDate, changeDate, changeTime } from "store/playhead";
import useInterval from "utils/useInterval";
import { RootState } from "store/index";

const FIVE_MINS_MS = 5 * 60 * 1000;

/**
 * Renders the main CODA application layout. Also handles checking whether the playhead should be running
 */
function Main(props: { query: QueryParams; collection: Collection }) {
  const playheadDate = useSelector((state: RootState) => state.playhead.date);
  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);

  const dispatch = useDispatch();

  const photoFiles = photosSelectors.selectAll(photos);
  const videoFiles = videoSelectors.selectAll(videos);

  // make sure the application is running on the correct date
  let userDate = null;

  const yyyymmdd = /^\d{4}-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|3[01])$/;
  if (!isNull(props.query.date) && !isNull(props.query.date.match(yyyymmdd))) {
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
    const month = d.getUTCMonth();
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
    if (!isNull(props.query.gmt)) {
      const [hh, mm, ss = 0] = props.query.gmt.split(":").map(Number);
      userTime = hh * 3600 + mm * 60 + ss;
    }

    dispatch(changeTime(userTime));
  }, []);

  // grab videos
  useEffect(() => {
    (async () => {
      if (isNull(playheadDate)) {
        return;
      }

      const d = new Date(playheadDate);

      // make sure we don't already have videos for this date
      if (haveVideosFromDate(videoFiles, d)) {
        return;
      }

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      try {
        // video data for this EVA
        const videoStore = await buildVideoStore(year, month + 1, day, props.collection);
        dispatch(addVideos(videoStore));
      } catch (e) {
        dispatch(videosFetchError(e.toString()));
        console.error(e);
      }
    })();
  }, [playheadDate]);

  // Grab photos
  useEffect(() => {
    (async () => {
      if (isNull(playheadDate)) {
        return;
      }

      if (photoFiles.length > 0) {
        return;
      }

      const d = new Date(playheadDate);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      try {
        // photos data for today
        const photoStore = await buildPhotoStore(year, month + 1, day, props.collection);
        dispatch(addPhotos(photoStore));
        const photoCollectionsFilter = buildPhotoCollections(photoStore);
        dispatch(setCollectionFilters(photoCollectionsFilter));
      } catch (e) {
        dispatch(photosFetchError(e.toString()));
        console.error(e);
      }
    })();
  }, [playheadDate]);

  // Grab GPS tracks
  useEffect(() => {
    (async () => {
      if (isNull(playheadDate || props.collection !== Collection.TEST_EVENTS)) {
        return;
      }

      const d = new Date(playheadDate);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();

      try {
        const gpsTracks = await getGPSTracks(year, month, day);
        dispatch(setGPSTracks(gpsTracks));
      } catch (e) {
        dispatch(gpsFetchError(e.toString()));
        console.error(e);
      }
    })();
  }, [playheadDate]);

  // Grab ISS orbit ephemeris data
  useEffect(() => {
    (async () => {
      if (isNull(playheadDate) || props.collection !== Collection.ISS) {
        return;
      }

      const d = new Date(playheadDate);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();

      try {
        // photos data for today
        const ephemerisStore = await buildEphemerisStore(year, month, day);
        dispatch(addEphemera(ephemerisStore));
      } catch (e) {
        dispatch(ephemeraFetchError(e.toString()));
        console.error(e);
      }
    })();
  }, [playheadDate]);

  // look for new videos every 5 minutes if the user is looking at today's date
  useInterval(() => {
    (async () => {
      // the playhead hasn't been set, no point in looking for videos
      if (isNull(playheadDate)) {
        return;
      }

      const d = new Date(playheadDate);
      if (!isSameDate(d, new Date())) {
        // the user is looking at a date in the past. no need to keep looking for new videos
        return;
      }

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();

      try {
        // video data for this EVA
        const videoStore = await buildVideoStore(year, month, day, props.collection);
        dispatch(addVideos(videoStore));
      } catch (e) {
        dispatch(videosFetchError(e.toString()));
        console.error(e);
      }
    })();
  }, FIVE_MINS_MS);

  /** Update the EVA store */
  const updateEVAs = () => {
    (async () => {
      try {
        // EVA data from the wiki (either actual EVAs, or test events that look like EVAs)
        const updatedEVAs =
          props.collection === Collection.ISS ? await fetchEVAs() : await fetchTestEvents();
        dispatch(addSequences(updatedEVAs));
      } catch (e) {
        dispatch(sequencesFetchError(e.toString()));
        console.error(e);
      }
    })();
  };

  // fetch updated data when the page loads
  useEffect(updateEVAs, []);

  // look for wiki info every 5 mins
  useInterval(updateEVAs, FIVE_MINS_MS);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Header {...props} />
      </div>
      <div className={styles.body}>
        <div className={styles.bodyRow1}>
          <Video playerID={1} {...props} />
          <Video playerID={2} {...props} />
          <Photos />
        </div>
        <div className={styles.bodyRow2}>
          <div style={{ flex: "1 1 auto" }}>
            {props.collection === Collection.TEST_EVENTS ? <TELocation /> : <ISSLocation />}
          </div>
          <div style={{ flex: "0 1 170px" }}></div>
        </div>
      </div>
      <div className={styles.footer}>
        <PlaybackControls />
        <NavTimeline {...props} />
        <StatusBar />
      </div>
    </div>
  );
}

export default WithPlayheadMonitor(Main);
