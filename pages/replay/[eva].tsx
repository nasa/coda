import type { GetServerSideProps, GetStaticPaths } from "next";
import Head from "next/head";
import Main from "components/main";
import {
  buildEVAStore,
  EVA,
  getAsExecuted,
  getAllEVAs,
  getDayNight,
  getCrew,
  Activity,
  ParsedCrewResults,
  DayNight,
} from "services/iss-wiki";
import getVideoData, { Videos } from "services/io";
import { assignStartEnd, generateTimingData, TimingData } from "store/videos";
import {
  getActivityPerformanceMissionTime,
  getDayNightMissionTime,
  getEVAStartMilliseconds,
} from "store/evas";
import { diff } from "store/clock";

export default function Replay({
  initialReduxState: {
    evas: { EVAs, selectedEVA },
  },
}) {
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
 * Define a list of paths to pre-render. In our case, we're using underscored versions of the EVA titles as parameters, eg. '/review/us_eva_1' or '/review/US_EVA_1' (either casing is allowed). We fetch the full list of EVAs from the wiki and make the title of each one a path
 * See https://nextjs.org/docs/basic-features/data-fetching#getstaticpaths-static-generation
 */
export const getStaticPaths: GetStaticPaths = async () => {
  // find out which EVAs are available
  const results = await getAllEVAs();

  let evas = Object.keys(results)
    .filter((k) => {
      // the wiki includes planned EVAs. only include EVAs that have already occured in the build
      const [Y, M, D] = results[k].printouts["Start date"][0].raw
        .substring(2)
        .split("/")
        .map(Number);
      return diff(new Date(), new Date(Y, M - 1, D)) > 0;
    })
    .map((k) => k.replace(/ /g, "_"));
  // allow lowercase URLs to work too
  evas = evas.concat(evas.map((eva) => eva.toLowerCase()));

  return {
    paths: evas.map((eva) => ({
      params: {
        eva,
      },
    })),
    // 404 if the EVA title parameter does not match exactly
    fallback: false,
  };
};

/**
 * Server-side call to hydrate the props, ie. to put data in all the components on the server before sending files to the client. This is where we perform all the requests to external APIs to get the data required to render the EVA
 * See https://nextjs.org/docs/basic-features/data-fetching#getstaticprops-static-generation
 * Why all the try-catch's in here? Because "Using a wiki as a database is like using graffiti on a bathroom wall as a contact list" - Ben Feist
 */
export const getStaticProps: GetServerSideProps = async ({ params: { eva } }) => {
  const evaName = (eva as string).toLowerCase();
  let evaErrorMessage = "";
  let videosErrorMessage = "";

  // fetch all data for the EVA store

  let EVAs: { [key: string]: EVA };
  let EVACrew: ParsedCrewResults;
  let asExecutedEV1: Activity[];
  let asExecutedEV2: Activity[];
  let dayNight: DayNight;
  try {
    EVAs = await buildEVAStore();
    asExecutedEV1 = await getAsExecuted(EVAs[evaName].name, 1);
    asExecutedEV2 = await getAsExecuted(EVAs[evaName].name, 2);
    dayNight = await getDayNight(EVAs[evaName].name);
    // TODO: not updating when you navigate from one EVA to another. only uses mock data?
    EVACrew = await getCrew(evaName);
  } catch (e) {
    console.error(e);
    evaErrorMessage = "Error fetching EVAs";
  }

  let videos: Videos;
  let timingData: TimingData;
  try {
    // video data for this EVA
    const [Y, M, D] = EVAs[evaName].startDate.split("/").map(Number);
    videos = await getVideoData(Y, M, D);
    timingData = generateTimingData(videos);
    videos = assignStartEnd(videos, timingData);

    EVAs[evaName].dayNight = getDayNightMissionTime(dayNight, timingData);
  } catch (e) {
    console.error(e);
    videosErrorMessage = "Error fetching videos";
  }

  return {
    props: {
      initialReduxState: {
        clock: {
          ready: true,
          isRunning: true,
          // set the applicationTime so the clock is running when CODA loads
          // we also need to set lastStarted on the client-side, see _app.js
          applicationTime: timingData.video_earliestStart.toISOString(),
          lastStarted: null,
          lastStopped: null,
        },
        evas: {
          EVAs,
          selectedEVA: evaName,
          EVACrew,
          errorMessage: evaErrorMessage,
        },
        videos: {
          videos,
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
