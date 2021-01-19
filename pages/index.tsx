import { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { getAllEVAs } from "services/iss-wiki";

function Index({ evas }) {
  return (
    <div>
      <Head>
        <title>{process.env.TITLE}</title>
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
  const results = await getAllEVAs();
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
