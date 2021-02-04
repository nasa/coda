import { useDispatch, useSelector } from "react-redux";
import { changeTime, ClockState, start, stop } from "store/clock";
import styles from "./playback-controls.module.css";

export default function PlaybackControls() {
  const { clock }: { clock: ClockState } = useSelector((state) => state);
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
          jumpTime(-30);
        }}
      >
        <div className={styles.jumpLeftImg}></div>
        <div className={styles.jumpLeftText}>30</div>
      </div>
      <div
        className={styles.jumpRight}
        onClick={() => {
          jumpTime(30);
        }}
      >
        <div className={styles.jumpRightImg}></div>
        <div className={styles.jumpRightText}>30</div>
      </div>
    </div>
  );
}
