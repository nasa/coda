import { useDispatch, useSelector } from "react-redux";
import deepEqual from "lodash/isEqual";
import { changeTime, ClockState, start, stop } from "store/clock";
import styles from "./playback-controls.module.css";
import { RootState } from "store/index";

export default function PlaybackControls() {
  const { clock }: { clock: ClockState } = useSelector((state: RootState) => state, deepEqual);
  const dispatch = useDispatch();

  const handlePlayPause = () => {
    if (clock.isRunning) {
      dispatch(stop());
    } else {
      dispatch(start());
    }
  };

  const jumpTime = (seconds: number) => {
    dispatch(changeTime(clock.time + seconds));
  };

  let playPauseSvgName;
  if (clock.isRunning) {
    playPauseSvgName = styles.pauseSVG;
  } else {
    playPauseSvgName = styles.playSVG;
  }
  return (
    <div className={styles.container}>
      <div className={styles.playPause}>
        <div
          className={`${styles.playPauseImg} ${playPauseSvgName}`}
          onClick={handlePlayPause}
        ></div>
      </div>
      <div
        className={styles.jumpLeft}
        onClick={() => {
          jumpTime(-5);
        }}
      >
        <div className={styles.jumpLeftImg}></div>
        <div className={styles.jumpLeftText}>5</div>
      </div>
      <div
        className={styles.jumpRight}
        onClick={() => {
          jumpTime(5);
        }}
      >
        <div className={styles.jumpRightImg}></div>
        <div className={styles.jumpRightText}>5</div>
      </div>
    </div>
  );
}
