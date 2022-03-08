import styles from "./about-overlay.module.css";
import Modal from "react-modal";
import StatusArea from "./status";
import AboutAccordion from "./about-accordion";
import { useEffect, useState } from "react";
import React from "react";
import { useCookies } from "react-cookie";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { useSelector } from "react-redux";
import { RootState } from "store/index";
import { LoadingStatusEnum } from "utils/enums";

/** hack to remove spurious error
 * https://stackoverflow.com/a/62791682/3533496
 */
React.useLayoutEffect = React.useEffect;

library.add(faTimesCircle);

export default function AboutOverlay(props: { modalIsOpen: boolean; setModalIsOpen: Function }) {
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);
  const gps: GPSState = useSelector((state: RootState) => state.gps);
  const ephemera: EphemeraEntityState = useSelector((state: RootState) => state.ephemera);

  const [isLoaded, setIsLoaded] = useState(false);
  const [closeAutomatically, setCloseAutomatically] = useState(false);

  const [cookies, setCookie] = useCookies(["CODA_CloseAutomatically"]);

  useEffect(() => {
    if (
      videos.loadingStatus === LoadingStatusEnum.LOADING ||
      photos.loadingStatus === LoadingStatusEnum.LOADING ||
      sequences.loadingStatus === LoadingStatusEnum.LOADING ||
      gps.loadingStatus === LoadingStatusEnum.LOADING ||
      ephemera.loadingStatus === LoadingStatusEnum.LOADING
    ) {
      setIsLoaded(false);
    } else {
      setIsLoaded(true);
    }
  }, [
    videos.loadingStatus,
    photos.loadingStatus,
    sequences.loadingStatus,
    gps.loadingStatus,
    ephemera.loadingStatus,
  ]);

  useEffect(() => {
    if (cookies["CODA_CloseAutomatically"] === "true") {
      setCloseAutomatically(true);
    } else {
      setCloseAutomatically(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && closeAutomatically) {
      props.setModalIsOpen(false);
    }
  }, [isLoaded, closeAutomatically]);

  const checkCloseAutomatically = () => {
    const newVal = !closeAutomatically;
    setCloseAutomatically(newVal);
    setCookie("CODA_CloseAutomatically", newVal.toString(), { path: "/" });
  };

  const titleText = isLoaded ? "Loading complete." : "Loading external data...";
  const titleShowGoButtonStyle = isLoaded ? "inline-block" : "none";

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
          style={{ display: `${isLoaded === true ? "block" : "none"}` }}
          onClick={() => {
            props.setModalIsOpen(false);
          }}
        >
          <FontAwesomeIcon icon="times-circle" size="2x" />
        </div>
        <div className={styles.container}>
          <div className={styles.leftSection}>
            <div className={styles.logo}>
              <div
                className={styles.verticalCenter}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  window.open("https://wiki.jsc.nasa.gov/exploration/index.php/CODA", "_blank");
                }}
              >
                <span className={styles.wordMark}>CODA</span>
              </div>
              <div className={styles.logoRight}>
                <img className={styles.meatball} src="/images/logo_NASA.svg" alt="NASA meatball" />
                <div
                  className={styles.logoEmssWrapper}
                  onClick={() => {
                    window.open(
                      "https://wiki.jsc.nasa.gov/exploration/index.php/EVA_Mission_System_Software",
                      "_blank"
                    );
                  }}
                >
                  <span className={styles.logoEmss}></span>
                </div>
              </div>
            </div>
            <div className={styles.description}>
              <div className={styles.strong}>Collaborative Operations Data Activation</div>
              <p>A JSC collaboration between XI, CX, XX, and SK.</p>
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
                <source src="https://emss-labs.fit.nasa.gov/public/coda-quick-tour.mp4" />
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
                    <div className={styles.headerHeadlineContainer}>
                      <div className={styles.headerHeadline}>{titleText}</div>
                      <button
                        className={styles.headerGoButton}
                        style={{ display: titleShowGoButtonStyle }}
                        onClick={() => {
                          props.setModalIsOpen(false);
                        }}
                      >
                        Start CODA
                      </button>
                    </div>
                    <div className={styles.headerBody}>
                      <div className={styles.headerBodyText}>
                        All data presented by CODA is housed in external systems. CODA retrieves
                        data from each system that pertains to the selected event.
                      </div>
                    </div>
                  </div>
                  <div className={styles.loadingRightSection}>
                    <div className={styles.rightSection}>
                      <StatusArea largeDisplay={true} />
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
                      Start CODA automatically when loaded
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
