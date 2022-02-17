import styles from "./about-overlay.module.css";
import Modal from "react-modal";
import StatusArea from "./status";
import AboutAccordion from "./about-accordion";
import { useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons";

library.add(faTimesCircle);

export default function AboutOverlay(props: { modalIsOpen: boolean; closeModalCB: Function }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [closeAutomatically, setCloseAutomatically] = useState(false);

  const [cookies, setCookie] = useCookies(["CODA_CloseAutomatically"]);

  useEffect(() => {
    if (cookies["CODA_CloseAutomatically"] === "true") {
      setCloseAutomatically(true);
    } else {
      setCloseAutomatically(false);
    }
  }, []);

  useEffect(() => {
    if (closeAutomatically) {
      props.closeModalCB();
    }
  }, [isLoaded, closeAutomatically]);

  const loadedCB = () => {
    setIsLoaded(true);
  };

  const checkCloseAutomatically = () => {
    const newVal = !closeAutomatically;
    setCloseAutomatically(newVal);
    setCookie("CODA_CloseAutomatically", newVal.toString(), { path: "/" });
  };

  const closeButtonXDisplay = isLoaded ? "block" : "none";
  const titleText = isLoaded ? "Loading complete." : "Loading external data...";

  return (
    <Modal
      isOpen={props.modalIsOpen}
      className={styles.modalWrapper}
      overlayClassName={styles.modalOverlay}
      contentLabel="Share"
      ariaHideApp={false}
    >
      <div className={styles.main}>
        <div
          className={styles.closeButtonX}
          style={{ display: closeButtonXDisplay }}
          onClick={() => {
            props.closeModalCB();
          }}
        >
          <FontAwesomeIcon icon="times-circle" size="lg" />
        </div>
        <div className={styles.container}>
          <div className={styles.leftSection}>
            <div className={styles.logo}>
              <div
                className={styles.verticalCenter}
                onClick={() => {
                  window.open(
                    "https://wiki.jsc.nasa.gov/exploration/index.php/EVA_Mission_System_Software",
                    "_blank"
                  );
                }}
              >
                <span className={styles.logoEmss}></span>
              </div>
              <div className={styles.verticalCenter}>
                <img className={styles.meatball} src="/images/logo_NASA.svg" alt="NASA meatball" />
              </div>
              <div
                className={styles.verticalCenter}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  window.open("https://wiki.jsc.nasa.gov/exploration/index.php/CODA", "_blank");
                }}
              >
                <span className={styles.wordMark}>CODA</span>
              </div>
            </div>
            <div className={styles.description}>
              <div className={styles.strong}>Collaborative Operations Data Activation</div>
              <p>
                Consolidating the context of mission, training, and testing data into an exploratory
                platform to relive and analyse each moment
              </p>
            </div>
            <div className={styles.strong} style={{ marginTop: "10px" }}>
              Quick Tour
            </div>
            <div className={styles.videoContainer}>
              <video className={styles.video} muted controls>
                <source
                  src="https://gitlab.fit.nasa.gov/coda/coda/-/wikis/uploads/f9f2a00730f8f9d7628cd946c334f4b2/spacex.mp4"
                  type="video/mp4"
                />
              </video>
            </div>
            <div className={styles.accordionWrapper}>
              <AboutAccordion />
            </div>
          </div>
          <div className={styles.rightSection}>
            <div className={styles.loadingArea}>
              <div className={styles.loadingContainer}>
                <div className={styles.loading}>
                  <div className={styles.loadingLeftSection}>
                    <div className={styles.largeHeadline}>{titleText}</div>
                    <div className={styles.largeBody}>
                      <div className={styles.largeBodyText}>
                        All data presented by CODA is housed in external systems. CODA retrieves
                        data from each system that pertains to the selected event.
                      </div>
                    </div>
                  </div>
                  <div className={styles.loadingRightSection}>
                    <div className={styles.rightSection}>
                      <StatusArea largeDisplay={true} loadedCB={loadedCB} />
                    </div>
                  </div>
                  <div className={styles.closeArea}>
                    {/* <div
                  onClick={() => {
                    props.closeModalCB();
                  }}
                >
                  <Button>Close</Button>
                </div> */}
                    <div className={styles.closeItem}>
                      <label>
                        <input
                          type="checkbox"
                          checked={closeAutomatically}
                          onChange={checkCloseAutomatically}
                        />
                      </label>
                      Close this window when loading complete
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.helpArea}>
              <div className={styles.helpCallout}></div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
