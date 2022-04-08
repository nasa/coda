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
import Button from "components/interface/button";

library.add(faCircleXmark);
const sgChannels = [0, 1, 2, 3];

export function TranscriptControls(props: { frameID: number; frameDimensions: [number, number] }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const minWidth = 470; // minimum width of the transcript pane before breaking into dropdown for downlinks

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

  const controlsLeft = () => {
    if (props.frameDimensions[0] > minWidth) {
      return (
        <div className={styles.selections}>
          {sgChannels.map((c) => {
            let rounded = "none";
            if (c === 0) {
              rounded = "left";
            } else if (c === 3) {
              rounded = "right";
            }

            let color = "disabled";

            color = "active";

            if (paneStateData.sgChannel === c) {
              color = "active_selected";
            }

            return (
              <Button
                key={"SGBUTTON_" + c + "_" + frameID}
                color={color}
                size="small"
                rounded={rounded}
                callback={() => {
                  setPaneStateValue(dispatch, frameID, "sgChannel", c);
                }}
              >
                <div className={styles.dlLabel}>{c + 1}</div>
              </Button>
            );
          })}
        </div>
      );
    } else {
      return (
        <>
          <div className={`${styles.selectContainer} ${styles.selectContainerNarrow}`}>
            <select
              value={paneStateData.sgChannel}
              onChange={(e) => {
                setPaneStateValue(dispatch, frameID, "channel", e.target.value);
              }}
            >
              <option value="">DL</option>
              {sgChannels.map((v) => {
                return (
                  <option value={v} key={v}>
                    {v + 1}
                  </option>
                );
              })}
            </select>
            <div className={styles.nonDlSelect_arrow}>
              <FontAwesomeIcon icon="chevron-down" size="sm" />
            </div>
          </div>
        </>
      );
    }
  };

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}>{controlsLeft()}</div>
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
  const transcripts = useSelector((state: RootState) => state.transcript.transcripts);
  const playhead = useSelector((state: RootState) => state.playhead);
  const paneStateData: TranscriptPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

  const [filterText, setFilterText] = useState("");
  const [isTranscripts, setIsTranscripts] = useState(false);
  const [filteredUtterances, setFiltereredUtterances] = useState([]);
  const [activeUtteranceSecs, setActiveUtteranceSecs] = useState(0);

  const frameID = props.frameID;
  const dispatch = useDispatch();

  const handleScroll = () => {
    if (paneStateData.lockTranscriptScroll) {
      setPaneStateValue(dispatch, frameID, "lockTranscriptScroll", false);
    }
  };

  const activeUtteranceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paneStateData.lockTranscriptScroll && activeUtteranceRef.current !== null) {
      activeUtteranceRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [activeUtteranceRef, playhead.seconds, paneStateData.lockTranscriptScroll]);

  useEffect(() => {
    let isTranscript = false;
    transcripts.forEach((transcript) => {
      if (transcript.utterances.length > 0) {
        isTranscript = true;
      }
    });
    setIsTranscripts(isTranscript);
  }, [transcripts]);

  useEffect(() => {
    if (isTranscripts) {
      let filteredUtterances: Utterance[] = transcripts[paneStateData.sgChannel].utterances;
      if (paneStateData.filterActive && filterText !== "") {
        filteredUtterances = transcripts[paneStateData.sgChannel].utterances.filter((utterance) => {
          return utterance.content.includes(filterText);
        });
      }
      setFiltereredUtterances(filteredUtterances);
    }
  }, [paneStateData, filterText, isTranscripts]);

  useEffect(() => {
    if (isTranscripts) {
      let activeUtteranceSecs = 0;
      if (isTranscripts) {
        for (let i = 0; i < transcripts[paneStateData.sgChannel].utterances.length; i++) {
          if (transcripts[paneStateData.sgChannel].utterances[i].secs > playhead.seconds) {
            activeUtteranceSecs =
              i !== 0 ? transcripts[paneStateData.sgChannel].utterances[i - 1].secs : 0;
            setActiveUtteranceSecs(activeUtteranceSecs);
            break;
          }
        }
      }
    }
  }, [playhead.seconds, isTranscripts]);

  function displayUtterance(utterance: Utterance, idx: number) {
    let uttClass = styles.speaker1;
    if (idx % 2 === 0) {
      uttClass = "";
    } else {
      uttClass = styles.utteranceColorAlt;
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
        <div className={styles.content}>{utterance.content}</div>
      </div>
    );
  }

  const displayFilterStyle = paneStateData.filterActive
    ? styles.filterSearch
    : styles.filterSearchHidden;

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
        <div>{filteredUtterances.map((utterance, idx) => displayUtterance(utterance, idx))}</div>
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
            Displays transcripts for all four space-to-ground channels.{" "}
            <i>Not available for all days</i>. We are currently processing audio for all days in
            reverse chronological order.
          </p>
          <p>
            Select a space-to-ground channel using the channel numbers above the transcript.
            <br />
            Filter for specific text using the filter button.
          </p>

          <p>Click on an utterance to jump to the moment the words were spoken.</p>
        </div>
      </HelpOverlay>
    </div>
  );
}
