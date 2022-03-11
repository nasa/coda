import Head from "next/head";
import Link from "next/link";
import styles from "./index.module.css";

export default function Index() {
  return (
    <div className={styles.main}>
      <Head>
        <title>{process.env.TITLE}</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.verticalCenter}>
          <div className={styles.description}>
            <div className={styles.logo}>
              <div className={styles.verticalCenter}>
                <img className={styles.meatball} src="/images/logo_NASA.svg" alt="NASA meatball" />
              </div>
              <div className={styles.verticalCenter}>
                <span className={styles.wordMark}>CODA</span>
              </div>
            </div>
            <div className={styles.description}>
              <div className={styles.strong}>Collaborative Operations Data Activation</div>
              <p>
                Consolidating the context of mission, training, and testing data into an exploratory
                platform to relive and analyse each moment
              </p>
              <p>A JSC collaboration between XI, CX, XX, and SK</p>
            </div>
          </div>
        </div>
        <div className={styles.verticalCenter}>
          <div className={styles.sources}>
            <div className={styles.sourcesPanel}>
              <div className={styles.sourcesHeader}>Select a Source</div>
              <ul className={styles.ul}>
                <li className={styles.li}>
                  <Link href="/view/?s=0">ISS</Link>
                </li>
                <li className={styles.li}>
                  <Link href="/view/?s=1">Test Events</Link>
                </li>
                <li className={styles.li}>
                  <Link href="/view/?s=2">NBL</Link>
                </li>
                <li className={styles.li}>
                  <span className={styles.disabled} title="Coming soon!">
                    Artemis
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
