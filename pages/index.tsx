import Head from "next/head";
import Link from "next/link";
import EVADropdown from "components/eva-dropdown";
import styles from "./index.module.css";
import type { GetServerSideProps } from "next";
import { EVA, getAllEVAs } from "services/iss-wiki";
import { initialState as playheadInitialState } from "store/playhead";
import { initialState as videosInitialState } from "store/videos";
import { EVAStore } from "store/evas";

export default function Index() {
  return (
    <div className={styles.container}>
      <Head>
        <title>{process.env.TITLE}</title>
      </Head>
      Welcome to CODA! Check out the{" "}
      <Link href="/view">
        <a>latest videos</a>
      </Link>{" "}
      or try out one of our many EVA replays.
      <div className={styles.dropdown}>
        <EVADropdown />
      </div>
    </div>
  );
}

/**
 * Server-side call to hydrate the props, ie. to put data in all the components on the server before sending files to the client. This is where we perform all the requests to external APIs to get the data required to render the EVA dropdown
 * See https://nextjs.org/docs/basic-features/data-fetching#getstaticprops-static-generation
 */
export const getStaticProps: GetServerSideProps = async () => {
  const EVAs: EVAStore = {};
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
  } catch (e) {
    console.error(e);
  }
  return {
    props: {
      initialReduxState: {
        playhead: playheadInitialState,
        evas: {
          objects: EVAs,
          selectedEVA: "",
        },
        videos: videosInitialState,
      },
    },
  };
};
