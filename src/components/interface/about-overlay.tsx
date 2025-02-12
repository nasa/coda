import styles from "./about-overlay.module.css";
import StatusArea from "./status";
import { useEffect, useState } from "react";
import { faEnvelope, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { RootState } from "store/index";
import { diff } from "utils/date";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const AboutOverlay = ({
  modalIsOpen,
  setModalIsOpen,
}: {
  modalIsOpen: boolean;
  setModalIsOpen: Function;
}) => {
  const sequences: SequencesState = useAppSelector(
    (state: RootState) => state.sequences,
    deepEqual
  );
  const videos: VideosState = useAppSelector((state: RootState) => state.videos, deepEqual);
  const photos: PhotosState = useAppSelector((state: RootState) => state.photos, deepEqual);
  const gps: GPSState = useAppSelector((state: RootState) => state.gps, deepEqual);
  const ephemera: EphemeraState = useAppSelector((state: RootState) => state.ephemera, deepEqual);

  const [isLoaded, setIsLoaded] = useState(false);

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

  const earliestCutoff = new Date("2013-03-30");
  const windowURL = window.location;
  let paramDate = String(windowURL).match(/\d{4}-\d{2}-\d{2}/);
  if (paramDate) {
    let [year, month, day] = paramDate[0].split("-");
    [year, month, day] = [year, month, String(parseInt(day) + 1)];
    const urlDate = new Date(`${year}-${month}-${day}`);
    var isBeforeRecording = diff(urlDate, earliestCutoff) < 0 ? true : false;
  }

  const titleText = isLoaded ? "Loading complete." : "Loading external data...";
  const titleShowGoButtonStyle =
    isLoaded && !isBeforeRecording ? styles.headerGoButtonEnabled : styles.headerGoButtonDisabled;

  return (
    <Modal
      isOpen={modalIsOpen}
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
              <div className={styles.strong}>Contextual Operations Data Activation</div>
              <p>
                Consolidating the context of mission, training, and testing data into an exploratory
                platform to relive and analyse each moment
              </p>
              <p>A JSC collaboration between XI, CX, and SK</p>
            </div>

            <div className={styles.aboutSection}>
              <div className={styles.aboutSectionTitle}>Email for help</div>
              <ul>
                <li>
                  <a href={"mailto:JSC-DL-EMSS-CODA@mail.nasa.gov"} target={"_blank"}>
                    <FontAwesomeIcon
                      className={styles.emailIconDistro}
                      icon={faEnvelope}
                      size={"xs"}
                    />
                    Team Distro List
                  </a>
                </li>
              </ul>
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
                  <TeamMemberCredit
                    fullName={"Ben Feist"}
                    position={"Concept, Software Engineering"}
                    email={"benjamin.f.feist@nasa.gov"}
                  />
                </li>
                <li>
                  <TeamMemberCredit
                    fullName={"David Charney"}
                    position={"Interaction and Visual Design"}
                    email={"david.w.charney@nasa.gov"}
                  />
                </li>
                <li>
                  <TeamMemberCredit
                    fullName={"Jackie Vu"}
                    position={"Software Engineering"}
                    email={"jackie.vu@nasa.gov"}
                  />
                </li>
                <li>
                  <TeamMemberCredit
                    fullName={"Luke McSherry"}
                    position={"Software Engineering"}
                    email={"luke.a.mcsherry@nasa.gov"}
                  />
                </li>
                <li>
                  <TeamMemberCredit
                    fullName={"Omar Baig"}
                    position={"Software Engineering"}
                    email={"omar.a.baig@nasa.gov"}
                  />
                </li>
                <li>
                  <TeamMemberCredit
                    fullName={"Cameron Pittman"}
                    position={"Software Architecture"}
                    email={"cameron.w.pittman@nasa.gov"}
                  />
                </li>
                <li>
                  <TeamMemberCredit
                    fullName={"Matthew Miller"}
                    position={"Project Management"}
                    email={"matthew.j.miller-1@nasa.gov"}
                  />
                </li>
                <li>
                  <TeamMemberCredit
                    fullName={"James Montalvo"}
                    position={"EMSS Lead"}
                    email={"edwin.j.montalvo@nasa.gov"}
                  />
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
                          setModalIsOpen(false);
                        }}
                      >
                        START CODA
                      </button>
                    </div>
                    {isBeforeRecording ? (
                      <div className={styles.errorMessageContainer}>
                        <FontAwesomeIcon icon={faTriangleExclamation} size={"sm"} />
                        <p className={styles.datePickerError}>
                          No EVA recording avaiable before 2013-03-30
                        </p>
                      </div>
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
};

const TeamMemberCredit = ({
  fullName,
  position,
  email,
}: {
  fullName: string;
  position: string;
  email: string;
}) => {
  return (
    <>
      <div className={styles.creditHeading}>
        <a className={styles.teamName} href={`mailto:${email}`}>
          {fullName}
        </a>
      </div>
      <div className={styles.teamTitle}>{position}</div>
    </>
  );
};

export default AboutOverlay;
