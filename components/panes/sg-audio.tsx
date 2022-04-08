import { HelpButton } from "components/interface/pane-help-control-button";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setPaneStateValue } from "store/framework";
import { RootState } from "store/index";
import styles from "./transcript.module.css";
import HelpOverlay from "components/interface/pane-help-overlay";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "components/interface/button";

const sgChannels = [0, 1, 2, 3];

export function SgAudioControls(props: { frameID: number; frameDimensions: [number, number] }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const minWidth = 470; // minimum width of the transcript pane before breaking into dropdown for downlinks

  const paneStateData: SgAudioPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

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

export default function SGAudio(props: { frameID: number }) {
  const sgActivityRanges = useSelector((state: RootState) => state.sgAudio.sgActivityRanges);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const paneStateData: SgAudioPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );

  const frameID = props.frameID;
  const dispatch = useDispatch();

  const [activeSgAudioObj, setActiveSgAudioObj] = useState({} as SgAudioObj);
  const [srcUrl, setSrcUrl] = useState("");

  const audioPlayerRef = useRef<HTMLVideoElement>(null);

  type SgAudioObj = {
    range: SgActivityRangeRecord;
    playOffset: number;
  };

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
          }/audio_files/SG${paneStateData.sgChannel + 1}/${
            activeSgAudioObj?.range?.aacSegmentFilename
          }`;
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

  useEffect(() => {
    if (audioPlayerRef.current) {
      if (activeSgAudioObj.playOffset > -1) {
        if (Math.abs(audioPlayerRef.current.currentTime - activeSgAudioObj.playOffset) > 1) {
          audioPlayerRef.current.currentTime = activeSgAudioObj.playOffset;
        }

        try {
          if (playhead.isRunning) {
            if (audioPlayerRef.current.paused) {
              audioPlayerRef.current.play();
            }
          } else {
            if (!audioPlayerRef.current.paused) {
              audioPlayerRef.current.pause();
            }
          }
        } catch (e) {
          // eat play errors. They are all bogus
        }
      } else {
        if (!audioPlayerRef.current.paused) {
          audioPlayerRef.current.pause();
        }
      }
    }
  }, [audioPlayerRef, playhead.seconds, playhead.isRunning]);

  return (
    <div className={styles.main}>
      <div>{activeSgAudioObj?.range?.aacSegmentFilename}</div>
      <div>{activeSgAudioObj?.playOffset}</div>
      <div>
        <video controls={true} autoPlay={true} loop={false} ref={audioPlayerRef} src={srcUrl} />
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
          </p>
          <p>Select a space-to-ground channel using the channel numbers above the transcript.</p>
        </div>
      </HelpOverlay>
    </div>
  );
}
