import styles from "./about-overlay.module.css";
import StatusArea from "./status";
import { useEffect, useState } from "react";
import { faEnvelope, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { deepEqual, useAppSelector, refEqual } from "utils/useAppSelector";
import { diff } from "utils/date";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { isDataTypeValidForSource, isDateValidForMtxVideo } from "utils/sourceDataTypeMap";

const mtxVideoMaxAgeDays = parseInt(import.meta.env.VITE_PUBLIC_MTX_VIDEO_MAX_AGE_DAYS, 10);

const AboutOverlay = ({
  modalIsOpen,
  setModalIsOpen,
}: {
  modalIsOpen: boolean;
  setModalIsOpen: Function;
}) => {
  const source = useAppSelector((state) => state.framework.source, refEqual);
  const clockDate = useAppSelector((state) => state.clock.date, refEqual);
  const sequences: SequencesState = useAppSelector((state) => state.sequences, deepEqual);
  const videos: VideosState = useAppSelector((state) => state.videos, deepEqual);
  const photos: PhotosState = useAppSelector((state) => state.photos, deepEqual);
  const gps: GPSState = useAppSelector((state) => state.gps, deepEqual);
  const ephemera: EphemeraState = useAppSelector((state) => state.ephemera, deepEqual);
  const graphs: GraphsState = useAppSelector((state) => state.graphs, deepEqual);
  const talkybot: TalkybotState = useAppSelector((state) => state.talkybot, deepEqual);

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if date is too old for MTX video
    const mtxVideoDateTooOld = !isDateValidForMtxVideo(clockDate, mtxVideoMaxAgeDays);

    // Check if data type is valid for source, or if it's skipped due to date
    const isMtxVideoLoaded =
      !isDataTypeValidForSource(source, "mtxvideo") ||
      mtxVideoDateTooOld ||
      videos.metadataMtx !== null ||
      videos.metadataMtx?.unneeded;

    const isIoVideoLoaded =
      !isDataTypeValidForSource(source, "videos") ||
      videos.metadataIo !== null ||
      videos.metadataIo?.unneeded;

    const isPhotosLoaded =
      !isDataTypeValidForSource(source, "photos") ||
      photos.metadata !== null ||
      photos.metadata?.unneeded;

    const isSequencesLoaded =
      (!isDataTypeValidForSource(source, "wikiEvas") &&
        !isDataTypeValidForSource(source, "wikiTestEvents")) ||
      sequences.metadata !== null ||
      sequences.metadata?.unneeded;

    const isGpsLoaded =
      !isDataTypeValidForSource(source, "gpstracks") ||
      gps.metadata !== null ||
      gps.metadata?.unneeded;

    const isEphemeraLoaded =
      !isDataTypeValidForSource(source, "ephemeris") ||
      ephemera.metadata !== null ||
      ephemera.metadata?.unneeded;

    const isTalkybotLoaded =
      !isDataTypeValidForSource(source, "talkybot") ||
      talkybot.metadata !== null ||
      talkybot.metadata?.unneeded;

    const isGraphsLoaded =
      !isDataTypeValidForSource(source, "graph") ||
      graphs.metadata !== null ||
      graphs.metadata?.unneeded;

    const allLoaded =
      isMtxVideoLoaded &&
      isIoVideoLoaded &&
      isPhotosLoaded &&
      isSequencesLoaded &&
      isGpsLoaded &&
      isEphemeraLoaded &&
      isTalkybotLoaded &&
      isGraphsLoaded;

    setIsLoaded(allLoaded);
  }, [
    source,
    clockDate,
    videos.metadataIo,
    videos.metadataMtx,
    photos.metadata,
    sequences.metadata,
    gps.metadata,
    ephemera.metadata,
    talkybot.metadata,
    graphs.metadata,
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
                    fullName={"Jackie Vu"}
                    position={"Software Engineering Lead"}
                    email={"jackie.vu@nasa.gov"}
                  />
                </li>
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
                    position={"Software Engineering"}
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
