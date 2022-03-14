import styles from "./about-overlay.module.css";
import Modal from "react-modal";
import StatusArea from "./status";
import { useEffect, useState } from "react";
import React from "react";
import { useCookies } from "react-cookie";
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
  const titleShowGoButtonStyle = isLoaded
    ? styles.headerGoButtonEnabled
    : styles.headerGoButtonDisabled;

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
              <p>
                Consolidating the context of mission, training, and testing data into an exploratory
                platform to relive and analyse each moment
              </p>
              <p>A JSC collaboration between XI, CX, and SK</p>
            </div>

            <div className={styles.aboutSection}>
              <div className={styles.aboutSectionTitle}>Useful Links</div>
              <ul>
                <li>
                  <a href={"https://wiki.jsc.nasa.gov/fod/index.php/CODA"} target={"_blank"}>
                    About CODA
                  </a>
                </li>
                <li>
                  <a
                    href={"https://wiki.jsc.nasa.gov/fod/index.php/EVA_Mission_Systems_Software"}
                    target={"_blank"}
                  >
                    About the EMSS effort
                  </a>
                </li>
                <li>
                  <a
                    href={"https://wiki.jsc.nasa.gov/fod/index.php/CODA/Awesome_Moments"}
                    target={"_blank"}
                  >
                    CODA Links to awesome moments
                  </a>
                </li>
              </ul>
              <div className={styles.aboutSectionTitle}>The Team</div>
              <ul className={styles.theTeamUl}>
                <li>
                  <div>
                    <a className={styles.teamName} href={"mailto:benjamin.f.feist@nasa.gov"}>
                      Ben Feist
                    </a>
                  </div>
                  <div className={styles.teamTitle}>
                    Concept, Software Engineering
                    <br />{" "}
                    <a className={styles.smallText} href={"mailto:benjamin.f.feist@nasa.gov"}>
                      Email for help
                    </a>
                  </div>
                </li>
                <li>
                  <div className={styles.creditHeading}>
                    <a className={styles.teamName} href={"mailto:david.w.charney@nasa.gov"}>
                      David Charney
                    </a>
                  </div>
                  <div className={styles.teamTitle}>Interaction and Visual Design</div>
                </li>
                <li>
                  <div className={styles.creditHeading}>
                    <a className={styles.teamName} href={"mailto:cameron.w.pittman@nasa.gov"}>
                      Cameron Pittman
                    </a>
                  </div>
                  <div className={styles.teamTitle}>
                    Software Architecture Lead,
                    <br />
                    Software Engineering
                  </div>
                </li>
                <li>
                  <div className={styles.creditHeading}>
                    <a className={styles.teamName} href={"mailto:matthew.j.miller-1@nasa.gov"}>
                      Matthew Miller
                    </a>
                  </div>
                  <div className={styles.teamTitle}>Project Management</div>
                </li>
                <li>
                  <div className={styles.creditHeading}>
                    <a className={styles.teamName} href={"mailto:edwin.j.montalvo@nasa.gov"}>
                      James Montalvo
                    </a>
                  </div>
                  <div className={styles.teamTitle}>EMSS Lead</div>
                </li>
              </ul>
            </div>
          </div>
          <div className={styles.rightSection}>
            <div className={styles.loadingArea}>
              <div className={styles.loadingContainer}>
                <div className={styles.loadingLeftSection}>
                  <div className={styles.headerHeadlineContainer}>
                    <div className={styles.headerHeadline}>{titleText}</div>
                  </div>
                  <StatusArea largeDisplay={true} />
                </div>
                <div className={styles.loadingRightSection}>
                  <div className={styles.rightSection}>
                    <div className={styles.closeArea}>
                      <button
                        className={`${styles.headerGoButton} ${titleShowGoButtonStyle}`}
                        onClick={() => {
                          props.setModalIsOpen(false);
                        }}
                      >
                        START CODA
                      </button>
                      <div className={styles.checkboxArea}>
                        <input
                          className={styles.checkbox}
                          type="checkbox"
                          checked={closeAutomatically}
                          onChange={checkCloseAutomatically}
                        />
                        <div>Start CODA automatically when loading complete</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.helpArea}>
              <div className={styles.headerHeadlineContainer} style={{ marginLeft: "35px" }}>
                <div className={styles.headerHeadline}>Using CODA</div>
              </div>
              <div className={styles.helpCallout}></div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
