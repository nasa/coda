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
} from "services/iss-wiki";
import getVideoData, { Videos } from "services/io";
import { assignStartEnd, generateTimingData, TimingData } from "store/videos";
import {
  getActivityPerformanceMissionTime,
  getDayNightMissionTime,
  getEVAStartMilliseconds,
} from "store/evas";
import { useRouter } from "next/router";
import { dateAsCanonicalString } from "utils/formatting";
import { useEffect } from "react";
import { ClockState, diff, set } from "store/clock";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// /view always tries to collect newest videos from IO and updates the nav-timeline
// /view?date=today-in-gmt is the same as /view
// view?date=date-in-past-gmt will fetch all videos for that 24-hour period
// leave /replay/eva alone for now

export default function View() {
  const {
    // date should be in YYYY/MM/DD format
    query: { date = null as string },
  } = useRouter();
  const { clock }: { clock: ClockState } = useSelector((state) => state);
  const dispatch = useDispatch();

  // make sure the application is running on the correct date
  if (typeof window !== "undefined") {
    let applicationDate = new Date();
    if (date) {
      const [Y, M, D] = (date as string).split("/");
      applicationDate = new Date(+Y, +M, +D);
    }

    if (
      !clock.applicationTime ||
      Math.abs(diff(new Date(clock.applicationTime), applicationDate)) > ONE_DAY_MS
    ) {
      dispatch(set(applicationDate.toISOString()));
    }
  }

  // TODO: do we refetch videos here in a `useInterval?`

  // TODO: set the clock.applicationTime?

  // TODO: check if there's an EVA on this date and ask if someone wants to redirect?

  useEffect(() => {
    (async () => {
      let videos: Videos;
      let timingData: TimingData;

      if (isNull(clock.applicationTime)) {
        return;
      }

      const d = new Date(clock.applicationTime);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      try {
        // video data for this EVA
        videos = await getVideoData(year, month + 1, day);
        timingData = generateTimingData(videos);
        videos = assignStartEnd(videos, timingData);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [clock.applicationTime]);

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
  let evaOnDate = null as string;
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
          selectedGroups: {
            left: 0,
            right: 1,
          },
          activeVideoFiles: {
            left: "",
            right: "",
          },
          ready: {
            left: true,
            right: true,
          },
          errorMessage: "",
        },
      },
    },
    // regenerate the props at most once per second if a request comes in
    revalidate: 1,
  };
};
