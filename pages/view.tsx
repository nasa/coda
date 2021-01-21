import { GetServerSideProps } from "next";
import Head from "next/head";
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
} from "services/iss-wiki";
import getVideoData, { Videos } from "services/io";
import { assignStartEnd, generateTimingData, TimingData } from "store/videos";
import {
  getActivityPerformanceMissionTime,
  getDayNightMissionTime,
  getEVAStartMilliseconds,
} from "store/evas";

// /view always tries to collect newest videos from IO and updates the nav-timeline
// /view?date=today-in-gmt is the same as /view
// view?date=date-in-past-gmt will fetch all videos for that 24-hour period
// leave /replay/eva alone for now

export default function View({
  initialReduxState: {
    evas: { EVAs, selectedEVA },
  },
}) {
  // TODO: do we refetch videos here in a `useInterval?`

  // TODO: set the clock.applicationTime?

  // TODO: here's code for getting videos
  let videos: Videos;
  let timingData: TimingData;
  try {
    // TODO: if date, break down the day into Y, M, D, otherwise get today's UTC
    videos = await getVideoData(Y, M, D);
    timingData = generateTimingData(videos);
    videos = assignStartEnd(videos, timingData);
  } catch (e) {
    console.error(e);
  }

  // TODO: check if there's an EVA on this date and ask if someone wants to redirect?

  return (
    <div>
      <Head>
        <title>
          {EVAs[selectedEVA].name} | {process.env.TITLE}
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
  let evaOnDate = null as string;
  let evaErrorMessage = "";
  let videosErrorMessage = "";

  const EVAs = {} as { [key: string]: EVA };
  let EVACrew = {} as ParsedCrewResults;
  try {
    const evas = await getAllEVAs();
    Object.keys(evas).forEach((eva) => {
      const formattedEVAName = eva.replace(/ /g, "_").toLowerCase();
      EVAs[formattedEVAName] = {
        name: eva,
        wikiURL: evas[eva].fullurl,
        displayTitle: evas[eva].printouts["EVA title"][0],
        startDate: evas[eva].printouts["Start date"][0].raw.substring(2),
        startTime: evas[eva].printouts["Start time"][0],
        // we don't have these properties yet
        duration: -1,
        activityPerformance: {},
        dayNight: {},
      };

      if (evas[eva].printouts["duration"].length === 1) {
        const [h, m] = evas[eva].printouts["duration"][0].split(":");
        const duration = +h * 3600 + +m * 60;
        EVAs[formattedEVAName].duration = duration;
      }
    });
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
          EVACrew,
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
          errorMessage: videosErrorMessage,
        },
      },
    },
    // regenerate the props at most once per second if a request comes in
    revalidate: 1,
  };
};
