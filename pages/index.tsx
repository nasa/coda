import Head from "next/head";
import Link from "next/link";
import Button from "components/button";
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
            <div className={styles.tourText}>
              <p>
                Lorem ipsump dolor sit amet. Yo this is a story all about how my life got
                twist-turned upside down. Now let me take a second; y'all just sit right there.
              </p>
            </div>
            <div style={{ marginTop: "10px" }}>
              <Button>Tour CODA</Button>
            </div>
          </div>
        </div>
        <div className={styles.verticalCenter}>
          <div className={styles.sources}>
            <div className={styles.sourcesPanel}>
              <span className={styles.sourcesHeader}>Select a Source</span>
              <ul className={styles.ul}>
                <li className={styles.li}>
                  <Link href="/view">ISS</Link>
                </li>
                <li className={styles.li}>
                  <Link href="/view/test-events">JSC Rock Yard</Link>
                </li>
                <li className={styles.li}>
                  <span className={styles.disabled} title="Coming soon!">
                    Artemis
                  </span>
                </li>
                <li className={styles.li}>
                  <span className={styles.disabled} title="Coming soon!">
                    NBL
                  </span>
                </li>
                <li className={styles.li}>
                  <span className={styles.disabled} title="Coming soon!">
                    NEEMO
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
