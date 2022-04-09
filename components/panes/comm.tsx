import { HelpButton } from "components/interface/pane-help-control-button";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setPaneStateValue } from "store/framework";
import { changeTime } from "store/playhead";
import { RootState } from "store/index";
import styles from "./comm.module.css";
import HelpOverlay from "components/interface/pane-help-overlay";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "components/interface/button";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faCircleXmark,
  faVolumeUp,
  faVolumeMute,
  faLock,
  faLockOpen,
} from "@fortawesome/free-solid-svg-icons";
import { MuteButton } from "components/panes/video";

library.add(faCircleXmark, faVolumeUp, faVolumeMute, faLock, faLockOpen);

const sgChannels = [0, 1, 2, 3];

export function CommControls(props: { frameID: number; frameDimensions: [number, number] }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const minWidth = 470; // minimum width of the transcript pane before breaking into dropdown for downlinks

  const paneStateData: CommPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  const sgActivityRanges = useSelector((state: RootState) => state.sgAudio.sgActivityRanges);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);

  const [channelAvailability, setChannelAvailability] = useState([]);

  useEffect(() => {
    if (sgActivityRanges?.length === 0) {
      return;
    }
    const cAvailability = [];
    for (const channel in sgChannels) {
      const activityRanges = sgActivityRanges[channel];
      let activeRange = false;
      for (let i = 0; i < activityRanges.length; i++) {
        const range = activityRanges[i];
        if (
          playhead.seconds >= range.sound_start_secs &&
          playhead.seconds <= range.sound_stop_secs
        ) {
          activeRange = true;
          break;
        }
      }
      cAvailability.push(activeRange);
    }
    setChannelAvailability(cAvailability);
  }, [sgActivityRanges, playhead.seconds]);

  let lockButtonSelected = "";
  if (typeof paneStateData !== "undefined" && paneStateData.lockScroll) {
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
                setPaneStateValue(dispatch, frameID, "sgChannel", e.target.value);
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
          <MuteButton
            clickHandler={() => {
              setPaneStateValue(dispatch, frameID, "isMuted", !paneStateData.isMuted);
            }}
            muted={paneStateData.isMuted}
          />
        </div>
        <div className={styles.verticalCenter}>
          <button
            className={`${styles.filterButton} ${filterButtonSelected}`}
            title={`Filter utterances by words`}
            onClick={() => {
              setPaneStateValue(dispatch, frameID, "filterActive", !paneStateData.filterActive);
            }}
          >
            <span>Filter</span>
          </button>
        </div>
        <div className={styles.verticalCenter}>
          <button
            className={`${styles.lockButton} ${lockButtonSelected}`}
            title={`Scroll automatically to the last spoken utterance`}
            onClick={() => {
              setPaneStateValue(dispatch, frameID, "lockScroll", !paneStateData.lockScroll);
            }}
          >
            <span className={styles.buttonLabel}>
              <div>Scroll</div>
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
}

type SgAudioObj = {
  range: SgActivityRangeRecord;
  playOffset: number;
};

export default function CommPane(props: { frameID: number }) {
  const transcripts = useSelector((state: RootState) => state.transcript.transcripts);
  const playhead = useSelector((state: RootState) => state.playhead);
  const sgActivityRanges = useSelector((state: RootState) => state.sgAudio.sgActivityRanges);
  const paneStateData: CommPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

  // SG audio state
  const [activeSgAudioObj, setActiveSgAudioObj] = useState({} as SgAudioObj);
  const [srcUrl, setSrcUrl] = useState("");

  // Transcript state
  const [filterText, setFilterText] = useState("");
  const [isTranscripts, setIsTranscripts] = useState(false);
  const [filteredUtterances, setFiltereredUtterances] = useState([]);
  const [activeUtteranceSecs, setActiveUtteranceSecs] = useState(0);

  const audioPlayerRef = useRef<HTMLVideoElement>(null);
  const activeUtteranceRef = useRef<HTMLDivElement>(null);

  const frameID = props.frameID;
  const dispatch = useDispatch();

  const handleScroll = () => {
    if (paneStateData.lockScroll) {
      setPaneStateValue(dispatch, frameID, "lockScroll", false);
    }
  };

  // Set the activeSgAudioObj for this second and update the srcUrl
  useEffect(() => {
    if (sgActivityRanges.length > 0) {
      const activityRanges = sgActivityRanges[paneStateData.sgChannel];
      let activeRange = false;
      for (let i = 0; i < activityRanges.length; i++) {
        const range = activityRanges[i];
        if (
          playhead.seconds >= range.sound_start_secs &&
          playhead.seconds <= range.sound_stop_secs
        ) {
          const newSrcUrl = `https://emss-labs.fit.nasa.gov/transcriptions/${
            playhead.date.split("T")[0]
          }/audio_files/SG${paneStateData.sgChannel + 1}/${range.aacSegmentFilename}`;
          if (srcUrl !== newSrcUrl) {
            setSrcUrl(newSrcUrl);
          }
          setActiveSgAudioObj({
            range,
            playOffset:
              playhead.seconds - range.sound_start_secs < range.sound_stop_secs
                ? playhead.seconds - range.sound_start_secs
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
  }, [sgActivityRanges, playhead.seconds]);

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
        if (playhead.ready && playhead.isRunning && paneStateData.ready) {
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
  }, [srcUrl, audioPlayerRef, playhead.seconds, playhead.isRunning]);

  useEffect(() => {
    if (paneStateData.lockScroll && activeUtteranceRef.current !== null) {
      activeUtteranceRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [activeUtteranceRef, playhead.seconds, paneStateData.lockScroll]);

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
