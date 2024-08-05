import styles from "./about-overlay.module.css";
import StatusArea from "./status";
import { useEffect, useState } from "react";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { useSelector } from "react-redux";
import { RootState } from "store/index";
import { diff } from "utils/date";
import Modal from "react-modal";

library.add(faTimesCircle);

export default function AboutOverlay(props: { modalIsOpen: boolean; setModalIsOpen: Function }) {
  const sequences: SequencesState = useSelector((state: RootState) => state.sequences);
  const videos: VideosState = useSelector((state: RootState) => state.videos);
  const photos: PhotosState = useSelector((state: RootState) => state.photos);
  const gps: GPSState = useSelector((state: RootState) => state.gps);
  const ephemera: EphemeraState = useSelector((state: RootState) => state.ephemera);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isBeforeRecording, setIsBeforeRecording] = useState(false);

  useEffect(() => {
    if (
      videos.loadingStatus === "loading" ||
      photos.loadingStatus === "loading" ||
      sequences.loadingStatus === "loading" ||
      gps.loadingStatus === "loading" ||
      ephemera.loadingStatus === "loading"
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
    // Attempt to find the date=####/##/## param
    const earliestCutoff = new Date("2013-03-30");
    const windowURL = window.location;
    let paramDate = String(windowURL).match(/\d{4}-\d{2}-\d{2}/);
    if (paramDate) {
      let [year, month, day] = paramDate[0].split("-");
      [year, month, day] = [year, month, String(parseInt(day) + 1)];
      const urlDate = new Date(`${year}-${month}-${day}`);

      if (diff(urlDate, earliestCutoff) < 0) {
        setIsBeforeRecording(true);
      }
    }
  }, []);

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
                    <a className={styles.teamName} href={"mailto:jackie.vu@nasa.gov"}>
                      Jackie Vu
                    </a>
                  </div>
                  <div className={styles.teamTitle}>Software Engineering</div>
                </li>
                <li>
                  <div className={styles.creditHeading}>
                    <a className={styles.teamName} href={"mailto:edwin.j.montalvo@nasa.gov"}>
                      James Montalvo
                    </a>
                  </div>
                  <div className={styles.teamTitle}>EMSS Lead</div>
                </li>
                <li>
                  <div className={styles.creditHeading}>
                    <a className={styles.teamName} href={"mailto:luke.a.mcsherry@nasa.gov"}>
                      Luke McSherry
                    </a>
                  </div>
                  <div className={styles.teamTitle}>Software Engineering</div>
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
                    </div>
                    {isBeforeRecording ? (
                      <p className={styles.noRecordingWarning}>
                        Warning: No EVA recordings avaliable.
                      </p>
                    ) : null}
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
