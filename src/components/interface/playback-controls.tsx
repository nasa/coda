import { FunctionComponent } from "react";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { changeTime, start, stop } from "store/playhead";
import styles from "./playback-controls.module.css";
import { RootState } from "store/index";

const PlaybackControls: FunctionComponent = () => {
  const playhead: PlayheadState = useAppSelector((state: RootState) => state.playhead, deepEqual);

  const dispatch = useAppDispatch();

  const handlePlayPause = () => {
    if (playhead.isRunning) {
      dispatch(stop());
    } else {
      dispatch(start());
    }
  };

  const jumpTime = (seconds: number) => {
    dispatch(changeTime(playhead.seconds + seconds));
  };

  let playPauseSvgName;
  if (playhead.isRunning) {
    playPauseSvgName = styles.pauseSVG;
  } else {
    playPauseSvgName = styles.playSVG;
  }
  return (
    <div className={styles.container}>
      <div className={styles.controlButton}>
        <div
          className={`${styles.playPauseImg} ${playPauseSvgName}`}
          onClick={handlePlayPause}
        ></div>
      </div>
      <div
        className={styles.controlButton}
        onClick={() => {
          jumpTime(-5);
        }}
      >
        <div className={styles.jumpLeftImg}></div>
        <div className={styles.jumpLeftText}>5</div>
      </div>
      <div
        className={styles.controlButton}
        onClick={() => {
          jumpTime(5);
        }}
      >
        <div className={styles.jumpRightImg}></div>
        <div className={styles.jumpRightText}>5</div>
      </div>
    </div>
  );
};

export default PlaybackControls;
