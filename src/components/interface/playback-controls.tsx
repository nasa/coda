import { FunctionComponent } from "react";
import styles from "./playback-controls.module.css";
import { usePlayheadContext } from "store/contextProviders/playheadContext";

const PlaybackControls: FunctionComponent = () => {
  const { playhead, setPlayhead } = usePlayheadContext();

  const handlePlayPause = () => {
    setPlayhead((prev) => ({
      ...prev,
      isRunning: !prev.isRunning,
    }));
  };

  const jumpTime = (seconds: number) => {
    setPlayhead((prev) => ({
      ...prev,
      appSeconds: prev.appSeconds + seconds,
    }));
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
