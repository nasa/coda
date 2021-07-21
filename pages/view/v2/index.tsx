import Head from "next/head";
import Header from "components/header-v2";
import styles from "./index.module.css";
import { useSelector } from "react-redux";

export default function V2() {
  const layout = useSelector((state) => state.viewer.layout);

  return (
    <div className={styles.main}>
      <Head>
        <title>{process.env.NEXT_PUBLIC_TITLE}</title>
      </Head>
      <Header />
      <div className={styles.body}>V2 goes here. Layout index: {layout}</div>
    </div>
  );
}
