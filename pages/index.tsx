import { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { getEVAs } from "services/iss-wiki";

function Index({ evas }) {
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
      Welcome to CODA! Try out one of our many EVA replays.
      <ul>
        {evas.map((eva) => (
          <li key={`home_page_list__${eva}`}>
            <Link href={`/replay/${eva.path}`}>
              <a>{eva.name}</a>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const getStaticProps: GetServerSideProps = async () => {
  const results = await getEVAs();
  const evas = Object.keys(results).map((k) => ({
    name: k,
    path: k.replace(/ /g, "_"),
  }));
  return {
    props: {
      evas,
    },
  };
};

export default Index;
