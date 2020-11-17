import { GetServerSideProps } from "next";
import Head from "next/head";
import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import AVPanels from "components/av-panels";
import { test } from "services/io";

/**
 * Server-side call to hydrate the props
 */
export const getServerSideProps: GetServerSideProps = async ({
  params: { eva },
}) => {
  // check if an EVA is happening now
  const data = await test(eva);
  return { props: data };
};

function Live({ data }) {
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
      <Header />
      <NavTimeline />
      <AVPanels />
    </div>
  );
}

export default Live;
