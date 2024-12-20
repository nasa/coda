import { HelpButton } from "components/interface/pane-help-control-button";
import { FunctionComponent, useEffect, useRef, useState } from "react";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { setPaneStateValue } from "store/framework";
import { RootState } from "store/index";
import styles from "./comm.module.css";
import HelpOverlay from "components/interface/pane-help-overlay";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "components/interface/button";
import {
  faCircleXmark,
  faLock,
  faLockOpen,
  faFilter,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import { MuteButton } from "components/panes/video";
import { usePlayheadContext } from "store/contextProviders/playheadContext";

const sgChannels = [0, 1, 2, 3];

export const CommControls: FunctionComponent<{
  frameID: number;
  frameDimensions: [number, number];
}> = ({ frameID, frameDimensions }) => {
  const dispatch = useAppDispatch();

  const minWidth = 470; // minimum width of the transcript pane before breaking into dropdown for downlinks

  const paneStateData: CommPaneStateData = useAppSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );
  const sgActivityFullUrlRecord = useAppSelector(
    (state: RootState) => state.sgAudio.sgActivityFullUrlRecord,
    deepEqual
  );

  const [channelAvailability, setChannelAvailability] = useState([]);

  const { playhead } = usePlayheadContext();

  useEffect(() => {
    if (
      !sgActivityFullUrlRecord?.sgActivityRangeFullUrlRecords ||
      (sgActivityFullUrlRecord?.sgActivityRangeFullUrlRecords &&
        sgActivityFullUrlRecord?.sgActivityRangeFullUrlRecords?.length === 0)
    ) {
      return;
    }
    const cAvailability = [];
    for (const channel in sgChannels) {
      const activityRanges = sgActivityFullUrlRecord?.sgActivityRangeFullUrlRecords[channel];
      let activeRange = false;
      for (let i = 0; i < activityRanges.length; i++) {
        const range = activityRanges[i];
        if (
          playhead.appSeconds >= range.sound_start_secs &&
          playhead.appSeconds <= range.sound_stop_secs
        ) {
          activeRange = true;
          break;
        }
      }
      cAvailability.push(activeRange);
    }
    setChannelAvailability(cAvailability);
  }, [sgActivityFullUrlRecord, playhead]);

  const buttonLength = frameDimensions[0] > minWidth ? styles.buttonLong : styles.buttonShort;
  let lockButtonSelected = "";
  if (paneStateData?.lockScroll) {
    lockButtonSelected = styles.buttonSelected;
  }
  let filterButtonSelected = "";
  if (paneStateData?.filterActive) {
    filterButtonSelected = styles.buttonSelected;
  }

  const controlsLeft = () => {
    if (frameDimensions[0] > minWidth) {
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
            if (channelAvailability[c]) {
              color = "active";
            }
            if (paneStateData.sgChannel === c) {
              if (channelAvailability[c]) {
                color = "active_selected";
              } else {
                color = "disabled_selected";
              }
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
                setPaneStateValue(dispatch, frameID, "sgChannel", parseInt(e.target.value));
              }}
            >
              <option value="" disabled={true}>
                DL
              </option>
              {sgChannels.map((v) => {
                return (
                  <option value={v} key={v}>
                    {v + 1}
                  </option>
                );
              })}
            </select>
            <div className={styles.nonDlSelect_arrow}>
              <FontAwesomeIcon icon={faChevronDown} size="sm" />
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
          <MuteButton
            clickHandler={() => {
              setPaneStateValue(dispatch, frameID, "isMuted", !paneStateData.isMuted);
            }}
            muted={paneStateData.isMuted}
          />
        </div>
        <div className={styles.verticalCenter}>
          <button
            className={`${styles.filterButton} ${buttonLength} ${filterButtonSelected}`}
            title={`Filter utterances by words`}
            onClick={() => {
              setPaneStateValue(dispatch, frameID, "filterActive", !paneStateData.filterActive);
            }}
          >
            <span className={styles.buttonLabel}>
              <div>{frameDimensions[0] > minWidth ? "Filter" : ""}</div>
              <div>
                <FontAwesomeIcon icon={faFilter} size="sm" />
              </div>
            </span>
          </button>
        </div>
        <div className={styles.verticalCenter}>
          <button
            className={`${styles.lockButton} ${buttonLength} ${lockButtonSelected}`}
            title={`Scroll automatically to the last spoken utterance`}
            onClick={() => {
              setPaneStateValue(dispatch, frameID, "lockScroll", !paneStateData.lockScroll);
            }}
          >
            <span className={styles.buttonLabel}>
              <div>{frameDimensions[0] > minWidth ? "Scroll" : ""}</div>
              <div>
                <FontAwesomeIcon icon={paneStateData.lockScroll ? faLock : faLockOpen} size="sm" />
              </div>
            </span>
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
};

type SgAudioObj = {
  range: SgActivityRangeFullUrlRecord;
  playOffset: number;
};

const CommPane: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const transcripts = useAppSelector((state: RootState) => state.transcript.transcripts, deepEqual);
  const isTranscripts = useAppSelector(
    (state: RootState) => state.transcript.isTranscripts,
    deepEqual
  );
  const sgActivityFullUrlRecord = useAppSelector(
    (state: RootState) => state.sgAudio.sgActivityFullUrlRecord,
    deepEqual
  );
  const paneStateData: CommPaneStateData = useAppSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );

  // SG audio state
  const [activeSgAudioObj, setActiveSgAudioObj] = useState({} as SgAudioObj);
  const [srcUrl, setSrcUrl] = useState("");

  // Transcript state
  const [filterText, setFilterText] = useState("");
  const [filteredUtterances, setFiltereredUtterances] = useState([]);
  const [activeUtteranceSecs, setActiveUtteranceSecs] = useState(0);

  const { playhead, setPlayhead } = usePlayheadContext();

  const audioPlayerRef = useRef<HTMLVideoElement>(null);
  const activeUtteranceRef = useRef<HTMLDivElement>(null);

  const dispatch = useAppDispatch();

  const handleScroll = () => {
    if (paneStateData.lockScroll) {
      setPaneStateValue(dispatch, frameID, "lockScroll", false);
    }
  };

  // Set the activeSgAudioObj for this second and update the srcUrl if audio unmuted, otherwise no need to load the audio file
  useEffect(() => {
    if (
      !sgActivityFullUrlRecord?.sgActivityRangeFullUrlRecords ||
      (sgActivityFullUrlRecord?.sgActivityRangeFullUrlRecords &&
        sgActivityFullUrlRecord?.sgActivityRangeFullUrlRecords?.length === 0)
    ) {
      return;
    }
    if (
      sgActivityFullUrlRecord.sgActivityRangeFullUrlRecords.length > 0 &&
      !paneStateData.isMuted
    ) {
      const activityRanges =
        sgActivityFullUrlRecord.sgActivityRangeFullUrlRecords[paneStateData.sgChannel];
      let activeRange = false;
      for (let i = 0; i < activityRanges.length; i++) {
        const range = activityRanges[i];
        if (
          playhead.appSeconds >= range.sound_start_secs &&
          playhead.appSeconds <= range.sound_stop_secs
        ) {
          const newSrcUrl = range.aacSegmentFullUrl;

          if (srcUrl !== newSrcUrl) {
            setSrcUrl(newSrcUrl);
          }
          setActiveSgAudioObj({
            range,
            playOffset:
              playhead.appSeconds - range.sound_start_secs < range.sound_stop_secs
                ? playhead.appSeconds - range.sound_start_secs
                : -1,
          });

          activeRange = true;
          break;
        }
      }
      if (!activeRange) {
        setActiveSgAudioObj({
          range: null,
          playOffset: -1,
        });
        setSrcUrl("");
      }
    }
  }, [sgActivityFullUrlRecord, playhead, paneStateData.isMuted]);

  // Cue the audio and figure out whether to play or pause the audio
  useEffect(() => {
    if (!audioPlayerRef.current || srcUrl === "") {
      return;
    }
    const isPlaying =
      audioPlayerRef.current.currentTime > 0 &&
      !audioPlayerRef.current.paused &&
      !audioPlayerRef.current.ended &&
      audioPlayerRef.current.readyState > audioPlayerRef.current.HAVE_CURRENT_DATA;

    if (activeSgAudioObj.playOffset > -1) {
      if (Math.abs(audioPlayerRef.current.currentTime - activeSgAudioObj.playOffset) > 1) {
        audioPlayerRef.current.currentTime = activeSgAudioObj.playOffset;
      }

      try {
        if (playhead.isRunning && paneStateData.ready) {
          if (!isPlaying && srcUrl !== "") {
            audioPlayerRef.current.play();
          }
        } else {
          audioPlayerRef.current.pause();
        }
      } catch (e) {
        // eat play errors. They are all bogus
      }
    } else {
      audioPlayerRef.current.pause();
    }
  }, [srcUrl, audioPlayerRef, playhead]);

  // Scroll to the active utterance
  useEffect(() => {
    if (paneStateData.lockScroll && activeUtteranceRef.current !== null) {
      activeUtteranceRef.current.scrollIntoView();
    }
  }, [activeUtteranceRef, playhead, paneStateData.lockScroll]);

  // Update the filtered utterances
  useEffect(() => {
    if (!isTranscripts) {
      return;
    }
    let filteredUtterances: Utterance[] = transcripts[paneStateData.sgChannel].utterances;
    if (paneStateData.filterActive && filterText !== "") {
      filteredUtterances = transcripts[paneStateData.sgChannel].utterances.filter((utterance) => {
        return utterance.content.includes(filterText);
      });
    }
    setFiltereredUtterances(filteredUtterances);
  }, [paneStateData, filterText, isTranscripts]);

  // Update the active utterance secds
  useEffect(() => {
    if (!isTranscripts) {
      return;
    }
    let aUtteranceSecs = 0;
    for (let i = 0; i < transcripts[paneStateData.sgChannel].utterances.length; i++) {
      if (transcripts[paneStateData.sgChannel].utterances[i].secs > playhead.appSeconds) {
        aUtteranceSecs = i !== 0 ? transcripts[paneStateData.sgChannel].utterances[i - 1].secs : 0;
        if (activeUtteranceSecs !== aUtteranceSecs) {
          setActiveUtteranceSecs(aUtteranceSecs);
        }
        break;
      }
    }
  }, [playhead, isTranscripts, paneStateData.sgChannel]);

  // Show the help panel if there are no transcripts
  useEffect(() => {
    if (isTranscripts) {
      setPaneStateValue(dispatch, frameID, "showHelp", false);
    } else {
      setPaneStateValue(dispatch, frameID, "showHelp", true);
    }
  }, [isTranscripts]);

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
          setPlayhead((prev) => ({
            ...prev,
            appSeconds: utterance.secs,
          }));
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
              <FontAwesomeIcon icon={faCircleXmark} size="lg" />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.player}>
        <video
          controls={true}
          autoPlay={false}
          loop={false}
          ref={audioPlayerRef}
          src={srcUrl}
          muted={paneStateData.isMuted}
          onCanPlay={() => {
            if (!paneStateData.ready) {
              setPaneStateValue(dispatch, frameID, "ready", true);
            }
          }}
          onEnded={() => {
            // ready up because we don't want a missing video to hold up the playhead
            setSrcUrl("");
            setPaneStateValue(dispatch, frameID, "ready", true);
          }}
          onWaiting={() => {
            if (paneStateData.ready && srcUrl !== "") {
              setPaneStateValue(dispatch, frameID, "ready", false);
            }
          }}
        />
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
          <p>Plays Space-to-ground comm audio for all 4 ISS S/G loops with transcripts for each.</p>
          <p>
            <span style={{ color: "yellow" }}>Not available for all days</span>. We are currently
            processing ISS audio in reverse chronological order. For days missing this comm audio,
            use the mute button on the videos to hear S/G 1 and 2.
          </p>
          <p>
            Select a S/G loop using the 4 channel numbers above. Use the Filter button to Filter for
            specific text.
          </p>
          <p>Click on an utterance to jump to the moment the words are spoken.</p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default CommPane;
