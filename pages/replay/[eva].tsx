import { GetServerSideProps, GetStaticPaths } from "next";
import Head from "next/head";
import Main from "components/main";
import {
  EVA,
  getAsExecuted,
  getAllEVAs,
  getEVADetails,
  getDayNight,
  getCrew,
  ParsedEVADetails,
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

function Replay({
  initialReduxState: {
    evas: { EVAs, selectedEVA },
  },
}) {
  return (
    <div>
      <Head>
        <meta charSet="utf-8" />
        <title>
          {EVAs[selectedEVA].name} | {process.env.TITLE}
        </title>
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
        <link rel="manifest" href="/favicon/site.webmanifest" />
        <link rel="mask-icon" href="/favicon/safari-pinned-tab.svg" color="#5bbad5" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono&display=swap"
          rel="stylesheet"
        />
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

  let evas = Object.keys(results).map((k) => k.replace(/ /g, "_"));
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
 */
export const getStaticProps: GetServerSideProps = async ({ params: { eva } }) => {
  const evaName = (eva as string).toLowerCase();
  let evaErrorMessage = "";
  let videosErrorMessage = "";

  // fetch all data for the EVA store

  const EVAs = {} as { [key: string]: EVA };
  let gEVADetails: ParsedEVADetails;
  let EVACrew: ParsedCrewResults;
  let asExecutedEV1: Activity[];
  let asExecutedEV2: Activity[];
  let dayNight: DayNight;
  try {
    const evas = await getAllEVAs();
    Object.keys(evas).forEach((evaName) => {
      const formattedEVAName = evaName.replace(/ /g, "_").toLowerCase();
      EVAs[formattedEVAName] = {
        name: evaName,
        wikiURL: evas[evaName].fullurl,
        displayTitle: evas[evaName].printouts["EVA title"][0],
        startDate: evas[evaName].printouts["Start date"][0].raw.substring(2),
        startTime: evas[evaName].printouts["Start time"][0],
        // we don't have these properties yet
        duration: -1,
        activityPerformance: {},
        dayNight: {},
      };
    });

    asExecutedEV1 = await getAsExecuted(evaName, 1);
    asExecutedEV2 = await getAsExecuted(evaName, 2);
    dayNight = await getDayNight(evaName);

    gEVADetails = await getEVADetails(evaName);
    EVACrew = await getCrew(evaName);
  } catch (e) {
    console.error(e);
    evaErrorMessage = "Error fetching EVAs";
  }

  let videos: Videos;
  let timingData: TimingData;
  try {
    const [h, m] = gEVADetails.duration.split(":");
    EVAs[evaName].duration = +h * 3600 + +m * 60;
    // video data for this EVA
    const [Y, M, D] = gEVADetails.evaDate.split(/-/).map(Number);
    videos = await getVideoData(Y, M, D);
    timingData = generateTimingData(videos);
    videos = assignStartEnd(videos, timingData);
  } catch (e) {
    console.error(e);
    videosErrorMessage = "Error fetching videos";
  }

  const activityStartUTCMilliseconds = getEVAStartMilliseconds(EVAs[evaName]);

  EVAs[evaName].activityPerformance["EV1"] = getActivityPerformanceMissionTime(
    asExecutedEV1,
    timingData,
    activityStartUTCMilliseconds
  );
  EVAs[evaName].activityPerformance["EV2"] = getActivityPerformanceMissionTime(
    asExecutedEV2,
    timingData,
    activityStartUTCMilliseconds
  );
  EVAs[evaName].dayNight = getDayNightMissionTime(dayNight, timingData);

  // in order to inject timing data into the page props, it has to be JSON serializable. Date() is not. Remember that server-side rendering means that the data that is returned from this function was originally fetched on the server and then sent to the client as a big JSON payload
  // the trick we're using to map over the existing video files object is:
  // (1) map over the existing object, returning an [id, newObj] array, (2) use `Object.fromEntries` to convert the array of [id, newObj] arrays back into an object with the same keys as the original
  const jsonifiedVideoFiles = Object.fromEntries(
    Object.keys(videos).map((v) => {
      const vid = videos[v];
      return [
        vid.id,
        {
          ...vid,
          description: vid.description || "",
          // overwrite the old start and end Date objects with strings
          ...{
            start: vid.start.toUTCString(),
            end: vid.end.toUTCString(),
          },
        },
      ];
    })
  );

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
          selectedEVA: eva,
          EVACrew,
          errorMessage: evaErrorMessage,
        },
        videos: {
          videos: jsonifiedVideoFiles,
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

export default Replay;
