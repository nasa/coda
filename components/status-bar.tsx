import { useSelector } from "react-redux";
import { add, ClockState } from "store/clock";
import { EVAsState } from "store/evas";
import { VideosState } from "store/videos";
import styles from "./status-bar.module.css";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function StatusBar() {
  const {
    clock: { isRunning },
    evas: { errorMessage: evasErrorMessage, selectedEVA },
    videos: { ready: videosReady, lastChecked, errorMessage: videosErrorMessage },
  }: {
    clock: ClockState;
    evas: EVAsState;
    videos: VideosState;
  } = useSelector((store) => store);

  const errorMessages = evasErrorMessage !== "" || videosErrorMessage !== "";

  const lastUpdate = new Date(lastChecked).toLocaleTimeString();
  const nextUpdate = add(new Date(lastChecked), FIVE_MINS_MS).toLocaleTimeString();

  return (
    <div className={`${styles.container} ${errorMessages ? styles.haveErrors : styles.noErrors}`}>
      <span className={styles.playPause}>
        &nbsp;
        {isRunning ? <span style={{ fontSize: "1.3em", lineHeight: "22px" }}>🞂</span> : "❙❙"}
      </span>
      <span className={styles.statusText}>
        {!videosReady.left || !videosReady.right ? <span className={styles.spinner}></span> : " "}
        {selectedEVA === "" && (
          <span>
            Last video update: {lastUpdate}. Next update scheduled for: {nextUpdate} |&nbsp;
          </span>
        )}
        <span>IO {videosErrorMessage === "" ? "✓" : "✗"}&nbsp;</span>
        <span>| ISS WIKI {evasErrorMessage === "" ? "✓" : "✗"}&nbsp; &nbsp;</span>
      </span>
    </div>
  );
}
