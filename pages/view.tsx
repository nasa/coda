import isNull from "lodash/isNull";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { useDispatch, useSelector } from "react-redux";
import Main from "components/main";
import { EVA, buildEVAStore } from "services/iss-wiki";
import { buildVideoStore, Videos } from "services/io";
import {
  add as addVideos,
  haveVideosFromDate,
  VideosState,
  initialState as videosInitialState,
} from "store/videos";
import { EVAsState, setSelected } from "store/evas";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { ClockState, initialState as clockInitialState, diff, isSameDate, set } from "store/clock";
import useInterval from "utils/useInterval";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function View() {
  const {
    // date should be in YYYY/MM/DD format
    // GMT should be in hh:mm:ss format
    query: { date = null, gmt = null },
  }: {
    query: { date?: string; gmt?: string };
  } = useRouter();
  const {
    clock,
    evas,
    videos,
  }: { clock: ClockState; evas: EVAsState; videos: VideosState } = useSelector((state) => state);
  const dispatch = useDispatch();

  // make sure the application is running on the correct date
  useEffect(() => {
    let userDate = new Date();
    //get date from query param if exists
    if (date !== null) {
      //get time from query param if exists

      //make cam proud
      let [hh, mm, ss] = gmt !== null ? (gmt as string).split(":").map(Number) : [0, 0, 0];

      const [year, month, day] = (date as string).split(/-|\//).map(Number);
      userDate = new Date(Date.UTC(year, month - 1, day, hh, mm, ss));

      // ignore the date param if it is in the future! (CODA doesn't have precogs yet!)
      // https://youtu.be/m_0s8IZWkBg
      const isFutureDate = diff(userDate, new Date()) > 0;
      const isMalformedDate = isNaN(userDate.valueOf());

      if (isFutureDate || isMalformedDate) {
        userDate = new Date();
      }
    }

    if (!clock.applicationTime || !isSameDate(new Date(clock.applicationTime), userDate)) {
      dispatch(set(userDate.toISOString()));
    }
  }, [date, gmt]);

  useEffect(() => {
    (async () => {
      if (isNull(clock.applicationTime)) {
        return;
      }

      const d = new Date(clock.applicationTime);

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
        console.error(e);
      }

      dispatch(addVideos({ videos: videoStore }));
    })();
  }, [clock.applicationTime]);

  // look for new videos every 5 minutes if the user is looking at today's date
  useInterval(() => {
    (async () => {
      // the clock hasn't been set, no point in looking for videos
      if (isNull(clock.applicationTime)) {
        return;
      }

      const d = new Date(clock.applicationTime);
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

  return (
    <div>
      <Head>
        <title>Viewer | {process.env.TITLE}</title>
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
        videos: {
          videos: {},
          videoDownlinks: videosInitialState.videoDownlinks,
          activeVideoFiles: videosInitialState.activeVideoFiles,
          ready: videosInitialState.ready,
          errorMessage: "",
        },
      },
    },
    // regenerate the props at most once per second if a request comes in
    revalidate: 1,
  };
};
