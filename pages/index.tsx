import Head from "next/head";
import Link from "next/link";
import styles from "./index.module.css";

export default function Index() {
  return (
    <div className={styles.container}>
      <Head>
        <title>{process.env.TITLE}</title>
      </Head>
      <ul>
        <li>
          <Link href="/view">
            <a>Latest ISS videos</a>
          </Link>
        </li>
        <li>
          <Link href="/view/test-events">
            <a>Latest test event videos</a>
          </Link>
        </li>
      </ul>
    </div>
  );
}
