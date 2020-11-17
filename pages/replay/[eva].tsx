import { GetServerSideProps, GetStaticPaths } from "next";
import Head from "next/head";
import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import AVPanels from "components/av-panels";
import { test } from "services/io";
import { getEVAs } from "services/iss-wiki";

function Replay({ eva, evas }) {
  return (
    <div>
      <Head>
        <meta charSet="utf-8" />
        <title>{process.env.TITLE}</title>
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
      <Header selectedEVA={eva} evas={evas} />
      <NavTimeline />
      <AVPanels />
    </div>
  );
}

/**
 * Define a list of paths to pre-render. In our case, we're using underscored versions of the EVA titles as parameters, eg. '/review/us_eva_1' or '/review/US_EVA_1' (either casing is allowed)
 * See https://nextjs.org/docs/basic-features/data-fetching#getstaticpaths-static-generation
 */
export const getStaticPaths: GetStaticPaths = async () => {
  // find out which EVAs are available
  const res = await getEVAs().then((res) => res.json());
  const results = res["query"]["results"];

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
 * Server-side call to hydrate the props. Pre-fetch all the data and links required to render the EVA
 */
export const getStaticProps: GetServerSideProps = async ({
  params: { eva },
}) => {
  const res = await getEVAs().then((res) => res.json());
  const results = res["query"]["results"];

  return {
    props: {
      eva,
      evas: results,
    },
    // regenerate the props at most once per minute if a request comes in
    revalidate: 60,
  };
};

export default Replay;
