import { useSelector } from "react-redux";
import { ClockState } from "store/clock";
import { EVAsState } from "store/evas";
import { VideosState } from "store/videos";
import styles from "./status-bar.module.css";

export default function StatusBar() {
  const {
    clock: { ready: clockReady, isRunning },
    evas: { errorMessage: evasErrorMessage },
    videos: { ready: videoReady, errorMessage: videosErrorMessage },
  }: {
    clock: ClockState;
    evas: EVAsState;
    videos: VideosState;
  } = useSelector((store) => store);
  // TODO:
  // render icons for ready states

  return (
    <div
      className={`${styles.container} ${
        isRunning ? styles.isRunning : styles.isStopped
      }`}
    >
      Status
    </div>
  );
}
