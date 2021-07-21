import Head from "next/head";
import Header from "components/header-v2";
import Viewer from "components/viewer";
import styles from "./index.module.css";

export default function V2() {
  return (
    <div className={styles.main}>
      <Head>
        <title>{process.env.NEXT_PUBLIC_TITLE}</title>
      </Head>
      <Header />
      <div className={styles.body}>
        <Viewer />
      </div>
    </div>
  );
}
