import isNull from "lodash/isNull";
import deepEqual from "lodash/isEqual";
import Head from "next/head";
import { useDispatch, useSelector } from "react-redux";
import Main from "components/main";
import { buildEVAStore } from "services/iss-wiki";
import { buildVideoStore, Videos, buildPhotoStore } from "services/io";
import {
  addVideos,
  haveVideosFromDate,
  VideosState,
  fetchError as videosFetchError,
} from "store/videos";
import { addPhotos, PhotosState, fetchError as photosFetchError } from "store/photos";
import { addEVAs } from "store/evas";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { PlayheadState, diff, isSameDate, changeDate, changeTime } from "store/playhead";
import useInterval from "utils/useInterval";
import { RootState } from "store/index";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function View() {
  const {
    // date should be in yyyy/mm/dd or yyyy-mm-dd format
    // gmt should be in hh:mm:ss format
    query: { date = null, gmt = null },
  }: {
    query: { date?: string; gmt?: string };
  } = useRouter();
  const {
    playhead,
    videos,
    photos,
  }: {
    playhead: PlayheadState;
    videos: VideosState;
    photos: PhotosState;
  } = useSelector((state: RootState) => state, deepEqual);
  const dispatch = useDispatch();

  // make sure the application is running on the correct date
  useEffect(() => {
    // default the date to today
    let userDate = new Date();

    // change the date if the user set the `date` query param
    if (!isNull(date)) {
      const [year, month, day] = date.split(/-|\//).map(Number);
      userDate.setUTCFullYear(year);
      userDate.setUTCMonth(month - 1);
      userDate.setUTCDate(day);
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
  }, [date]);

  // make sure the application is running on the correct time
  useEffect(() => {
    // default the time to 00:00:00Z
    let userTime = 0;

    // change the time if the user set the `gmt` query param
    if (!isNull(gmt)) {
      const [hh, mm, ss = 0] = gmt.split(":").map(Number);
      userTime = hh * 3600 + mm * 60 + ss;
    }

    if (userTime !== playhead.seconds) {
      dispatch(changeTime(userTime));
    }
  }, [gmt]);

  // grab videos
  useEffect(() => {
    (async () => {
      if (isNull(playhead.date)) {
        return;
      }

      const d = new Date(playhead.date);

      // make sure we don't already have videos for this date
      if (haveVideosFromDate(videos, d)) {
        return;
      }

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      try {
        // video data for this EVA
        const videoStore = await buildVideoStore(year, month + 1, day);
        dispatch(addVideos({ videos: videoStore }));
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

      if (Object.keys(photos.photos).length > 0) {
        return;
      }

      const d = new Date(playhead.date);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      try {
        // photos data for today
        const photoStore = await buildPhotoStore(year, month + 1, day);
        dispatch(addPhotos({ photos: photoStore }));
      } catch (e) {
        dispatch(photosFetchError(e.toString()));
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
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      try {
        // video data for this EVA
        const videoStore: Videos = await buildVideoStore(year, month + 1, day);
        dispatch(addVideos({ videos: videoStore }));
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
        const updatedEVAs = await buildEVAStore();
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
    const options = { timeZone: "UTC", year: "numeric", month: "short", day: "2-digit" };
    prefix = d.toLocaleDateString("en-gb", options);
  }

  return (
    <div>
      <Head>
        <title>
          {prefix} | {process.env.TITLE}
        </title>
      </Head>
      <Main />
    </div>
  );
}
