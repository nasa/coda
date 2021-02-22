import isNull from "lodash/isNull";
import deepEqual from "lodash/isEqual";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { useDispatch, useSelector } from "react-redux";
import Main from "components/main";
import { EVA, buildEVAStore } from "services/iss-wiki";
import { buildVideoStore, Videos, buildPhotoStore, Photos } from "services/io";
import {
  addVideos,
  haveVideosFromDate,
  VideosState,
  initialState as videosInitialState,
  fetchError as videosFetchError,
} from "store/videos";
import {
  addPhotos,
  PhotosState,
  initialState as photosInitialState,
  fetchError as photosFetchError,
} from "store/photos";
import { EVAsState, setSelected } from "store/evas";
import { useRouter } from "next/router";
import { useEffect } from "react";
import {
  ClockState,
  initialState as clockInitialState,
  diff,
  isSameDate,
  changeDate,
  changeTime,
} from "store/clock";
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
    clock,
    evas,
    videos,
    photos,
  }: { clock: ClockState; evas: EVAsState; videos: VideosState; photos: PhotosState } = useSelector(
    (state: RootState) => state,
    deepEqual
  );
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

    if (!clock.date || !isSameDate(new Date(clock.date), userDate)) {
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

    if (userTime !== clock.time) {
      dispatch(changeTime(userTime));
    }
  }, [gmt]);

  useEffect(() => {
    (async () => {
      if (isNull(clock.date)) {
        return;
      }

      const d = new Date(clock.date);

      // try to find an EVA on this date
      let hit = false;
      for (let eva in evas.EVAs) {
        const [year, month, day] = evas.EVAs[eva].startDate.split("/").map(Number);
        if (isSameDate(new Date(Date.UTC(year, month - 1, day)), d)) {
          if (evas.selectedEVA !== eva) {
            // the new date has an EVA
            dispatch(setSelected(eva));
          }
          // we already know which EVA is happening on this date
          hit = true;
          break;
        }
      }
      if (!hit && evas.selectedEVA !== "") {
        // the user used to be looking at an EVA but no EVA is on this new date
        dispatch(setSelected(""));
      }

      // make sure we don't already have videos for this date
      if (haveVideosFromDate(videos, d)) {
        return;
      }

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      let videoStore: Videos;
      try {
        // video data for this EVA
        videoStore = await buildVideoStore(year, month + 1, day);
      } catch (e) {
        dispatch(videosFetchError(e.toString()));
        console.error(e);
      }
      dispatch(addVideos({ videos: videoStore }));
    })();
  }, [clock.date]);

  // Grab photos
  useEffect(() => {
    (async () => {
      if (isNull(clock.date)) {
        return;
      }

      if (Object.keys(photos.photos).length > 0) {
        return;
      }

      const d = new Date(clock.date);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      let photoStore: Photos;
      try {
        // photos data for today
        photoStore = await buildPhotoStore(year, month + 1, day);
      } catch (e) {
        dispatch(photosFetchError(e.toString()));
        console.error(e);
      }
      dispatch(addPhotos({ photos: photoStore }));
    })();
  }, [clock.date]);

  // look for new videos every 5 minutes if the user is looking at today's date
  useInterval(() => {
    (async () => {
      // the clock hasn't been set, no point in looking for videos
      if (isNull(clock.date)) {
        return;
      }

      const d = new Date(clock.date);
      if (!isSameDate(d, new Date())) {
        // the user is looking at a date in the past. no need to keep looking for new videos
        return;
      }

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      let videoStore: Videos;
      try {
        // video data for this EVA
        videoStore = await buildVideoStore(year, month + 1, day);
      } catch (e) {
        console.error(e);
      }

      dispatch(addVideos({ videos: videoStore }));
    })();
  }, FIVE_MINS_MS);

  let prefix = "Viewer";
  if (!isNull(clock.date)) {
    const d = new Date(clock.date);
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

/**
 * Server-side call to hydrate the props, ie. to put data in all the components on the server before sending files to the client. This is where we perform all the requests to external APIs to get the data required to render the EVA
 * See https://nextjs.org/docs/basic-features/data-fetching#getstaticprops-static-generation
 */
export const getStaticProps: GetServerSideProps = async () => {
  let evaOnDate = "";
  let evaErrorMessage = "";

  let EVAs: { [key: string]: EVA };
  try {
    EVAs = await buildEVAStore();
  } catch (e) {
    console.error(e);
    evaErrorMessage = "Error fetching EVA list";
  }

  return {
    props: {
      initialReduxState: {
        clock: clockInitialState,
        evas: {
          EVAs,
          selectedEVA: evaOnDate,
          EVACrew: {},
          errorMessage: evaErrorMessage,
        },
        videos: videosInitialState,
        photos: photosInitialState,
      },
    },
    // regenerate the props at most once per second if a request comes in
    revalidate: 1,
  };
};
