import Head from "next/head";
// import Link from "next/link";
import Button from "components/button";
import styles from "./index.module.css";

export default function Index() {
  return (
    <div className={styles.container}>
      <Head>
        <title>{process.env.TITLE}</title>
      </Head>
      <div className={styles.intro}>
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
              Lorem ipsump dolor sit amet. Yo this is a story all about how my life got twist-turned
              upside down. Now let me take a second; y'all sit right there.
            </p>
          </div>
          <div style={{ marginTop: "10px" }}>
            <Button>TOUR CODA</Button>
          </div>
        </div>
        <div className={styles.sources}>
          <div className={styles.sourcesPanel}>
            <span className={styles.greyedOut}>Select a Source</span>
            <ul className={styles.ul}>
              <li className={styles.li}>
                <a href="/view">ISS</a>
              </li>
              <li className={styles.li}>
                <a href="/view/test-events">Test Events</a>
              </li>
              <li className={styles.li}>
                <a href="/view/nbl">NBL</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
