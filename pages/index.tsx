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
          <Link href="/view/iss">
            <a>View ISS Data</a>
          </Link>
        </li>
        <li>
          <Link href="/view/nbl">
            <a>View NBL Data</a>
          </Link>
        </li>
        <li>
          <Link href="/view/test-events">
            <a>View Test Event Data</a>
          </Link>
        </li>
      </ul>
    </div>
  );
}
