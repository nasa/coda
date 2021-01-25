import isNull from "lodash/isNull";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useDispatch, useSelector, useStore } from "react-redux";
import Main from "components/main";
import {
  EVA,
  getAsExecuted,
  getAllEVAs,
  getDayNight,
  getCrew,
  ParsedCrewResults,
  Activity,
  DayNight,
  buildEVAStore,
  getAllAsExecuted,
} from "services/iss-wiki";
import getVideoData, { buildVideoStore, Videos } from "services/io";
import {
  add as addVideos,
  assignStartEnd,
  generateTimingData,
  haveVideosFromDate,
  TimingData,
  VideosState,
  initialState as videosInitialState,
} from "store/videos";
import {
  evasSlice,
  EVAsState,
  getActivityPerformanceMissionTime,
  getDayNightMissionTime,
  getEVAStartMilliseconds,
  setSelected,
} from "store/evas";
import { useRouter } from "next/router";
import { dateAsCanonicalString } from "utils/formatting";
import { useEffect } from "react";
import { ClockState, diff, isSameDate, set } from "store/clock";
import useInterval from "utils/useInterval";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FIVE_MINS_MS = 5 * 60 * 1000;

// /view always tries to collect newest videos from IO and updates the nav-timeline
// /view?date=today-in-gmt is the same as /view
// view?date=date-in-past-gmt will fetch all videos for that 24-hour period
// leave /replay/eva alone for now

export default function View() {
  const {
    // date should be in YYYY/MM/DD format
    query: { date = null as string },
  } = useRouter();
  const {
    clock,
    evas,
    videos,
  }: { clock: ClockState; evas: EVAsState; videos: VideosState } = useSelector((state) => state);
  const dispatch = useDispatch();

  // make sure the application is running on the correct date
  if (typeof window !== "undefined") {
    let applicationDate = new Date();
    if (date) {
      const [Y, M, D] = (date as string).split("/").map(Number);
      const userDate = new Date(Date.UTC(Y, M - 1, D, 0, 0, 0, 0));

      // only use the userDate if it's in the past (CODA doesn't have precogs!)
      if (diff(new Date(), userDate) >= 0) {
        applicationDate = userDate;
      }
    }

    if (
      !clock.applicationTime ||
      Math.abs(diff(new Date(clock.applicationTime), applicationDate)) > ONE_DAY_MS
    ) {
      dispatch(set(applicationDate.toISOString()));
    }
  }

  useEffect(() => {
    (async () => {
      if (isNull(clock.applicationTime)) {
        return;
      }

      const d = new Date(clock.applicationTime);

      // try to find an EVA on this date
      let hit = false;
      for (let eva in evas.EVAs) {
        const [Y, M, D] = evas.EVAs[eva].startDate.split("/");
        if (isSameDate(new Date(Date.UTC(+Y, +M - 1, +D, 0, 0, 0, 0)), d)) {
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
        clock: {
          ready: true,
          isRunning: true,
          // set the applicationTime so the clock is running when CODA loads
          // we also need to set lastStarted on the client-side, see _app.js
          applicationTime: null,
          lastStarted: null,
          lastStopped: null,
        },
        evas: {
          EVAs,
          selectedEVA: evaOnDate,
          EVACrew: {},
          errorMessage: evaErrorMessage,
        },
        videos: {
          videos: {},
          selectedGroups: videosInitialState.selectedGroups,
          activeVideoFiles: videosInitialState.activeVideoFiles,
          ready: videosInitialState.ready,
          status: videosInitialState.status,
          errorMessage: "",
        },
      },
    },
    // regenerate the props at most once per second if a request comes in
    revalidate: 1,
  };
};
