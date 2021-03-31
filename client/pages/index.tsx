import Head from "next/head";
import Link from "next/link";
import styles from "./index.module.css";

export default function Index() {
  return (
    <div className={styles.container}>
      <Head>
        <title>{process.env.TITLE}</title>
      </Head>
      Welcome to CODA! Check out the{" "}
      <Link href="/view">
        <a>latest videos</a>
      </Link>
    </div>
  );
}
