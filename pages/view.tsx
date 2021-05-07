import isNull from "lodash/isNull";
import Head from "next/head";
import { useDispatch, useSelector } from "react-redux";
import Main from "components/main";
import { fetchEVAs } from "client/evas";
import { buildVideoStore, buildPhotoStore, buildPhotoCollections } from "client/media";
import { buildEphemerisStore } from "client/location";
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
import { addEVAs } from "store/evas";
import { addEphemera, fetchError as ephemeraFetchError } from "store/ephemera";
import { useEffect } from "react";
import { PlayheadState, diff, isSameDate, changeDate, changeTime } from "store/playhead";
import useInterval from "utils/useInterval";
import { RootState } from "store/index";

const FIVE_MINS_MS = 5 * 60 * 1000;

const View = (props: { query: QueryParams }) => {
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);

  const dispatch = useDispatch();

  const photoFiles = photosSelectors.selectAll(photos);
  const videoFiles = videoSelectors.selectAll(videos);

  // make sure the application is running on the correct date
  useEffect(() => {
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

    if (!playhead.date || !isSameDate(new Date(playhead.date), userDate)) {
      dispatch(changeDate(userDate.toISOString()));
    }

    // make sure the application is running on the correct time
    // default the time to 00:00:00Z
    let userTime = 0;

    // change the time if the user set the `gmt` query param
    if (!isNull(props.query.gmt)) {
      const [hh, mm, ss = 0] = props.query.gmt.split(":").map(Number);
      userTime = hh * 3600 + mm * 60 + ss;
    }

    if (userTime !== playhead.seconds) {
      dispatch(changeTime(userTime));
    }
  }, []);

  // grab videos
  useEffect(() => {
    (async () => {
      if (isNull(playhead.date)) {
        return;
      }

      const d = new Date(playhead.date);

      // make sure we don't already have videos for this date
      if (haveVideosFromDate(videoFiles, d)) {
        return;
      }

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      try {
        // video data for this EVA
        const videoStore = await buildVideoStore(year, month + 1, day);
        dispatch(addVideos(videoStore));
      } catch (e) {
        dispatch(videosFetchError(e.toString()));
        console.error(e);
      }
    })();
  }, [playhead.date]);

  // Grab photos
  useEffect(() => {
    (async () => {
      if (isNull(playhead.date)) {
        return;
      }

      if (photoFiles.length > 0) {
        return;
      }

      const d = new Date(playhead.date);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      try {
        // photos data for today
        const photoStore = await buildPhotoStore(year, month + 1, day);
        dispatch(addPhotos(photoStore));
        const photoCollectionsFilter = buildPhotoCollections(photoStore);
        dispatch(setCollectionFilters(photoCollectionsFilter));
      } catch (e) {
        dispatch(photosFetchError(e.toString()));
        console.error(e);
      }
    })();
  }, [playhead.date]);

  // Grab ISS orbit ephemeris data
  useEffect(() => {
    (async () => {
      if (isNull(playhead.date)) {
        return;
      }

      const d = new Date(playhead.date);

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
  }, [playhead.date]);

  // look for new videos every 5 minutes if the user is looking at today's date
  useInterval(() => {
    (async () => {
      // the playhead hasn't been set, no point in looking for videos
      if (isNull(playhead.date)) {
        return;
      }

      const d = new Date(playhead.date);
      if (!isSameDate(d, new Date())) {
        // the user is looking at a date in the past. no need to keep looking for new videos
        return;
      }

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();

      try {
        // video data for this EVA
        const videoStore = await buildVideoStore(year, month, day);
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
        // EVA data from the wiki
        const updatedEVAs = await fetchEVAs();
        dispatch(addEVAs(updatedEVAs));
      } catch (e) {
        // dispatch(evasFetchError(e.toString()));
        console.error(e);
      }
    })();
  };

  // fetch updated data when the date changes
  useEffect(updateEVAs, [playhead.date]);

  // look for wiki info every 5 mins
  useInterval(updateEVAs, FIVE_MINS_MS);

  let prefix = "Viewer";
  if (!isNull(playhead.date)) {
    const d = new Date(playhead.date);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "2-digit",
    };
    prefix = d.toLocaleDateString("en-gb", options);
  }

  return (
    <div>
      <Head>
        <title>
          {prefix} | {process.env.TITLE}
        </title>
      </Head>
      <Main {...props} />
    </div>
  );
};

export async function getServerSideProps({ query }) {
  const date = query.date === undefined ? null : query.date;
  const gmt = query.gmt === undefined ? null : query.gmt;
  const video1 = query.video1 === undefined ? null : query.video1;
  const video2 = query.video2 === undefined ? null : query.video2;

  const returnVal: QueryParams = {
    gmt,
    date,
    video1,
    video2,
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
  /** Downlink number the user wants to view */
  video1: string;
  /** Downlink number the user wants to view */
  video2: string;
}

export default View;
