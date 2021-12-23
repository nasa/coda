import _ from "lodash";
import { useDispatch, useSelector } from "react-redux";
import Frame from "components/v2/framework/frame";
import { allLayouts } from "store/viewer";
import styles from "./viewer.module.css";

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
import {
  addVideos,
  haveVideosFromDate,
  setVideoLoadingStatus,
  videoSelectors,
  fetchError as videosFetchError,
} from "store/videos";
import {
  addPhotos,
  photosSelectors,
  setCollectionFilters,
  setPhotoLoadingStatus,
  fetchError as photosFetchError,
} from "store/photos";
import { buildPhotoCollections, buildPhotoStore, buildVideoStore } from "http-client/media";
import { setGpsLoadingStatus, setGPSTracks, gpsFetchError } from "store/gps";
import { buildEphemerisStore } from "http-client/location";
import {
  setEphemeraLoadingStatus,
  fetchError as ephemeraFetchError,
  addEphemera,
} from "store/ephemera";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function Viewer(props: { query: QueryParams; collection: Collection }) {
  const playheadDate = useSelector((state: RootState) => state.playhead.date);
  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);

  const dispatch = useDispatch();

  const photoFiles = photosSelectors.selectAll(photos);
  const videoFiles = videoSelectors.selectAll(videos);

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
    if (!_.isNull(props.query.gmt)) {
      const [hh, mm, ss = 0] = props.query.gmt.split(":").map(Number);
      userTime = hh * 3600 + mm * 60 + ss;
    }

    dispatch(changeTime(userTime));
  }, []);

  // grab videos
  useEffect(() => {
    (async () => {
      if (_.isNull(playheadDate)) {
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

      dispatch(setVideoLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        // video data for this EVA
        const videoStoreResponse = await buildVideoStore(year, month + 1, day, props.collection);
        if (videoStoreResponse.metadata.error === undefined) {
          dispatch(addVideos(videoStoreResponse));
        } else {
          dispatch(videosFetchError(videoStoreResponse.metadata.error));
        }
      } catch (e) {
        dispatch(videosFetchError(e.toString()));
      }
      dispatch(setVideoLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  }, [playheadDate]);

  // Grab photos
  useEffect(() => {
    (async () => {
      if (_.isNull(playheadDate)) {
        return;
      }

      if (photoFiles.length > 0) {
        return;
      }

      const d = new Date(playheadDate);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      dispatch(setPhotoLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        // photos data for today
        const photoStoreResponse = await buildPhotoStore(year, month + 1, day, props.collection);
        if (photoStoreResponse.metadata.error === undefined) {
          dispatch(addPhotos(photoStoreResponse));
          const photoCollectionsFilter = buildPhotoCollections(photoStoreResponse.data);
          dispatch(setCollectionFilters(photoCollectionsFilter));
        } else {
          dispatch(photosFetchError(photoStoreResponse.metadata.error));
        }
      } catch (e) {
        dispatch(photosFetchError(e.toString()));
      }
      dispatch(setPhotoLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  }, [playheadDate]);

  // Grab GPS tracks
  useEffect(() => {
    (async () => {
      if (_.isNull(playheadDate)) {
        return;
      }

      if (props.collection !== Collection.TEST_EVENTS) {
        dispatch(setGpsLoadingStatus(LoadingStatusEnum.UNNEEDED));
        return;
      }

      const d = new Date(playheadDate);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();

      dispatch(setGpsLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        const gpsTracksResponse = await getGPSTracks(year, month, day);
        if (gpsTracksResponse.metadata.error === undefined) {
          dispatch(setGPSTracks(gpsTracksResponse));
        } else {
          dispatch(ephemeraFetchError(gpsTracksResponse.metadata.error));
        }
      } catch (e) {
        dispatch(gpsFetchError(e.toString()));
      }
      dispatch(setGpsLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  }, [playheadDate]);

  // Grab ISS orbit ephemeris data
  useEffect(() => {
    (async () => {
      if (_.isNull(playheadDate)) {
        return;
      }

      if (props.collection !== Collection.ISS) {
        dispatch(setEphemeraLoadingStatus(LoadingStatusEnum.UNNEEDED));
        return;
      }

      const d = new Date(playheadDate);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();

      dispatch(setEphemeraLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        const ephemerisStoreResponse = await buildEphemerisStore(year, month, day);
        if (ephemerisStoreResponse.metadata.error === undefined) {
          dispatch(addEphemera(ephemerisStoreResponse));
        } else {
          dispatch(ephemeraFetchError(ephemerisStoreResponse.metadata.error));
        }
      } catch (e) {
        dispatch(ephemeraFetchError(e.toString()));
      }
      dispatch(setEphemeraLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  }, [playheadDate]);

  // look for new videos every 5 minutes if the user is looking at today's date
  useInterval(() => {
    (async () => {
      // the playhead hasn't been set, no point in looking for videos
      if (_.isNull(playheadDate)) {
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

      dispatch(setVideoLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        // video data for this EVA
        const videoStoreResponse = await buildVideoStore(year, month + 1, day, props.collection);
        if (videoStoreResponse.metadata.error === undefined) {
          dispatch(addVideos(videoStoreResponse));
        } else {
          dispatch(videosFetchError(videoStoreResponse.metadata.error));
        }
      } catch (e) {
        dispatch(videosFetchError(e.toString()));
      }
      dispatch(setVideoLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  }, FIVE_MINS_MS);

  /** Update the EVA store */
  const updateEVAs = () => {
    (async () => {
      dispatch(setSequenceLoadingStatus(LoadingStatusEnum.LOADING));
      try {
        // EVA data from the wiki (either actual EVAs, or test events that look like EVAs)
        const updatedEVAsResponse =
          props.collection === Collection.ISS ? await fetchEVAs() : await fetchTestEvents();
        if (updatedEVAsResponse.metadata.error === undefined) {
          dispatch(addSequences(updatedEVAsResponse));
        } else {
          dispatch(sequencesFetchError(updatedEVAsResponse.metadata.error));
        }
      } catch (e) {
        dispatch(sequencesFetchError(e.toString()));
      }
      dispatch(setSequenceLoadingStatus(LoadingStatusEnum.LOADED));
    })();
  };

  // fetch updated data when the page loads
  useEffect(updateEVAs, [playheadDate]);

  // look for wiki info every 5 mins
  useInterval(updateEVAs, FIVE_MINS_MS);

  const selectedLayout = useSelector((state: RootState) => state.viewer.layout);
  const layoutDefinition = allLayouts[selectedLayout];

  const frames = [];
  for (let i = 1; i <= layoutDefinition.frameCount; i++) {
    // CSS Grid definitions
    const gridAreaName = styles[`f${i}`];
    frames.push(
      <div className={`${styles.frameContainer} ${gridAreaName}`} key={`FRAME__${i}`}>
        <Frame id={i} />
      </div>
    );
  }

  return (
    <div>
      <div className={`${styles.main} ${styles[`layout${selectedLayout}`]}`}>{frames}</div>
    </div>
  );
}
