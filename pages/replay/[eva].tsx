import { GetServerSideProps, GetStaticPaths } from "next";
import Head from "next/head";
import Main from "components/main";
import {
  EVA,
  getAsExecuted,
  getAllEVAs,
  getEVADetails,
  getCrew,
  EVASummaryResponse,
  ParsedEVADetails,
  ParsedCrewResults,
} from "services/iss-wiki";
import getVideoData, { Videos } from "services/io";
import { assignStartEnd, generateTimingData } from "store/videos";

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
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/favicon/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon/favicon-16x16.png"
        />
        <link rel="manifest" href="/favicon/site.webmanifest" />
        <link
          rel="mask-icon"
          href="/favicon/safari-pinned-tab.svg"
          color="#5bbad5"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap"
          rel="stylesheet"
        ></link>
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
export const getStaticProps: GetServerSideProps = async ({
  params: { eva },
}) => {
  const evaName = (eva as string).toLowerCase();
  let evaErrorMessage = "";
  let videosErrorMessage = "";

  // fetch all data for the EVA store

  const EVAs = {} as { [key: string]: EVA };
  let gEVADetails: ParsedEVADetails;
  let EVACrew: ParsedCrewResults;
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
      };
    });

    EVAs[evaName].activityPerformance["EV1"] = await getAsExecuted(evaName, 1);
    EVAs[evaName].activityPerformance["EV2"] = await getAsExecuted(evaName, 2);

    gEVADetails = await getEVADetails(evaName);
    EVACrew = await getCrew(evaName);
  } catch (e) {
    console.error(e);
    evaErrorMessage = "Error fetching EVAs";
  }

  let videos: Videos;
  try {
    const [h, m] = gEVADetails.duration.split(":");
    EVAs[evaName].duration = +h * 3600 + +m * 60;
    // video data for this EVA
    const [Y, M, D] = gEVADetails.evaDate.split(/-/).map(Number);
    videos = await getVideoData(Y, M, D);
    const timingData = generateTimingData(videos);
    videos = assignStartEnd(videos, timingData);
  } catch (e) {
    console.error(e);
    videosErrorMessage = "Error fetching videos";
  }

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
            left: false,
            right: false,
          },
          errorMessage: videosErrorMessage,
        },
      },
    },
    // regenerate the props at most once per minute if a request comes in
    revalidate: 60,
  };
};

export default Replay;
