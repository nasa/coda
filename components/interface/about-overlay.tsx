import styles from "./about-overlay.module.css";
import Modal from "react-modal";
import Button from "./button";
import Link from "next/link";

export default function AboutOverlay(props: { modalIsOpen: boolean }) {
  return (
    <Modal
      isOpen={props.modalIsOpen}
      className={styles.modalWrapper}
      overlayClassName={styles.modalOverlay}
      contentLabel="Share"
      ariaHideApp={false}
    >
      <div className={styles.main}>
        <div className={styles.container}>
          <div className={styles.verticalCenter}>
            <div className={styles.description}>
              <div className={styles.logo}>
                <div className={styles.verticalCenter}>
                  <img
                    className={styles.meatball}
                    src="/images/logo_NASA.svg"
                    alt="NASA meatball"
                  />
                </div>
                <div className={styles.verticalCenter}>
                  <span className={styles.wordMark}>CODA</span>
                </div>
              </div>
              <div className={styles.description}>
                <p>
                  <div className={styles.strong}>Collaborative Operations Data Activation</div>
                  Consolidating the context of mission, training, and testing data into an
                  exploratory platform to relive and analyse each moment
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
    </Modal>
  );
}
