import { HelpButton } from "components/interface/pane-help-control-button";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setPaneStateValue } from "store/framework";
import { changeTime } from "store/playhead";
import { RootState } from "store/index";
import styles from "./transcript.module.css";
import HelpOverlay from "components/interface/pane-help-overlay";
import { library } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleXmark } from "@fortawesome/free-solid-svg-icons";

library.add(faCircleXmark);

export function TranscriptControls(props: { frameID: number }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const paneStateData: TranscriptPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  let lockButtonSelected = "";
  if (typeof paneStateData !== "undefined" && paneStateData.lockTranscriptScroll) {
    lockButtonSelected = styles.buttonSelected;
  }
  let filterButtonSelected = "";
  if (typeof paneStateData !== "undefined" && paneStateData.filterActive) {
    filterButtonSelected = styles.buttonSelected;
  }

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}></div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <button
            className={`${styles.filterButton} ${filterButtonSelected}`}
            title={`Filter utterances by words`}
            onClick={() => {
              setPaneStateValue(dispatch, frameID, "filterActive", !paneStateData.filterActive);
            }}
          >
            <span className={styles.lockButtonLabel}>Filter</span>
          </button>
        </div>
        <div className={styles.verticalCenter}>
          <button
            className={`${styles.lockButton} ${lockButtonSelected}`}
            title={`Scroll automatically to the last spoken utterance`}
            onClick={() => {
              setPaneStateValue(
                dispatch,
                frameID,
                "lockTranscriptScroll",
                !paneStateData.lockTranscriptScroll
              );
            }}
          >
            <span className={styles.lockButtonLabel}>Lock Scroll</span>
          </button>
        </div>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => {
              setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
            }}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
}

export default function TranscriptPane(props: { frameID: number }) {
  const utterances = useSelector((state: RootState) => state.transcript.utterances);
  const playhead = useSelector((state: RootState) => state.playhead);
  const paneStateData: TranscriptPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

  const [filterText, setFilterText] = useState("");

  const frameID = props.frameID;
  const dispatch = useDispatch();

  const handleScroll = () => {
    setPaneStateValue(dispatch, frameID, "lockTranscriptScroll", false);
  };

  const activeUtteranceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const showHelp = utterances.length === 0 ? true : false;
    setPaneStateValue(dispatch, frameID, "showHelp", showHelp);
  }, [utterances]);

  useEffect(() => {
    if (paneStateData.lockTranscriptScroll && activeUtteranceRef.current !== null) {
      activeUtteranceRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [activeUtteranceRef, playhead.seconds, paneStateData.lockTranscriptScroll]);

  function displayUtterance(utterance: Utterance, activeUtteranceSecs: number) {
    let uttClass = styles.speaker1;
    if (utterance.speaker.includes("1")) {
      uttClass = styles.speaker1;
    } else if (utterance.speaker.includes("2")) {
      uttClass = styles.speaker2;
    } else {
      uttClass = styles.speakerOther;
    }

    const activeRefOnly = utterance.secs === activeUtteranceSecs ? { ref: activeUtteranceRef } : {};
    const activeUtteranceStyle =
      utterance.secs === activeUtteranceSecs ? styles.activeUtterance : "";

    return (
      <div
        className={`${styles.utterance} ${uttClass} ${activeUtteranceStyle}`}
        key={utterance.id}
        {...activeRefOnly}
        onClick={() => {
          dispatch(changeTime(Math.round(utterance.secs)));
        }}
      >
        <div className={styles.time}>{utterance.time}</div>
        {/* <div className={styles.speaker}>{utterance.speaker}</div> */}
        <div className={styles.content}>{utterance.content}</div>
      </div>
    );
  }

  let activeUtteranceSecs = 0;

  let filteredUtterances: Utterance[] = utterances;
  if (paneStateData.filterActive && filterText !== "") {
    filteredUtterances = utterances.filter((utterance) => {
      return utterance.content.includes(filterText);
    });
  }

  for (let i = 0; i < utterances.length; i++) {
    if (utterances[i].secs > playhead.seconds) {
      activeUtteranceSecs = i !== 0 ? utterances[i - 1].secs : 0;
      break;
    }
  }

  const displayFilterStyle = paneStateData.filterActive
    ? styles.filterSearch
    : styles.filterSearchHidden;

  const urlRoot = location.origin;

  return (
    <div className={styles.main}>
      <div className={displayFilterStyle}>
        <div className={styles.inputBoxContainer}>
          <input
            type="text"
            name="filterField"
            placeholder="Text to filter for"
            value={filterText}
            className={styles.inputBox}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <div className={styles.verticalCenter}>
            <div
              className={styles.icon}
              onClick={() => {
                setFilterText("");
                setPaneStateValue(dispatch, frameID, "filterActive", false);
              }}
            >
              <FontAwesomeIcon icon="circle-xmark" size="lg" />
            </div>
          </div>
        </div>
      </div>
      <div
        className={styles.utterancesContainer}
        onWheel={() => {
          handleScroll();
        }}
      >
        <div>
          {filteredUtterances.map((utterance) => displayUtterance(utterance, activeUtteranceSecs))}
        </div>
      </div>
      <HelpOverlay
        isModalOpen={paneStateData.showHelp}
        closeHandler={() => {
          setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
        }}
      >
        <div>
          <p>
            <span style={{ color: "yellow" }}>!!Prototype!!</span>
            <br />
            Displays transcripts for the day using a prototype audio extraction method and a
            transcription service setup by CD for evaluation.
          </p>
          <p>
            The only days that have transcripts are
            <br />
            <a
              href={`${urlRoot}/view?date=2021-03-13&gmt=16:34:00&v=2.0&l=n&s=0&f1=01001iss064m010721622&f2=01051iss064m160721624&f3=0300&f4=04&f5=08&f6=04&f7=08`}
            >
              2021-03-13
            </a>{" "}
            and{" "}
            <a
              href={`${urlRoot}/view?date=2022-03-23&gmt=10:34:13&v=2.0&l=n&s=0&f1=01001iss066m010821022&f2=01011&f3=0300&f4=0701&f5=051&f6=04&f7=08`}
            >
              2022-03-23
            </a>
            .<br />
            <span style={{ color: "yellow" }}>!!Prototype!!</span>
          </p>
          <p></p>
          <p>Click on an utterance to jump to the moment the words were spoken.</p>
        </div>
      </HelpOverlay>
    </div>
  );
}
