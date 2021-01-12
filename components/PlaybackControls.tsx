import { useDispatch, useSelector } from "react-redux";
import { ClockState, start, stop } from "store/clock";
import styles from "./playbackControls.module.css";

export default function PlaybackControls() {
  const { clock }: { clock: ClockState } = useSelector((state) => state);
  const dispatch = useDispatch();

  const handlePlayPause = (e) => {
    // alert("yay this button doesn't work");
    console.log("play/pause clicked");
    if (clock.isRunning) {
      //FIXME: this doesn't do anything for some unknown reason
      dispatch(stop());
    } else {
      dispatch(start());
    }
  };

  let svgName;
  if (clock.isRunning) {
    svgName = styles.pauseSVG;
  } else {
    svgName = styles.playSVG;
  }
  return (
    <div className={styles.container}>
      <div className={styles.playPause}>
        <div className={`${styles.playPauseBtn} ${svgName}`} onClick={handlePlayPause}></div>
      </div>
    </div>
  );
}
