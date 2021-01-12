import { useSelector } from "react-redux";
import { ClockState } from "store/clock";
import { EVAsState } from "store/evas";
import { VideosState } from "store/videos";
import styles from "./status-bar.module.css";

export default function StatusBar() {
  const {
    clock: { isRunning },
    evas: { errorMessage: evasErrorMessage },
    videos: { ready: videosReady, errorMessage: videosErrorMessage },
  }: {
    clock: ClockState;
    evas: EVAsState;
    videos: VideosState;
  } = useSelector((store) => store);

  const errorMessages = evasErrorMessage !== "" || videosErrorMessage !== "";

  return (
    <div className={`${styles.container} ${errorMessages ? styles.haveErrors : styles.noErrors}`}>
      <span className={styles.playPause}>
        &nbsp;
        {isRunning ? <span style={{ fontSize: "1.3em", lineHeight: "22px" }}>🞂</span> : "❙❙"}
      </span>
      <span className={styles.statusText}>
        Connection Statuses: IO {videosErrorMessage === "" ? "✓" : "✗"} | ISS WIKI{" "}
        {evasErrorMessage === "" ? "✓" : "✗"}&nbsp;
        {!videosReady.left && !videosReady.right ? <span className={styles.spinner}></span> : " "}
        &nbsp;
      </span>
    </div>
  );
}
