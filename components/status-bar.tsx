import { useSelector } from "react-redux";
import { add, ClockState, isSameDate } from "store/clock";
import { EVAsState } from "store/evas";
import { VideosState } from "store/videos";
import styles from "./status-bar.module.css";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function StatusBar() {
  const {
    clock: { isRunning, date },
    evas: { errorMessage: evasErrorMessage },
    videos: { ready: videosReady, lastChecked, errorMessage: videosErrorMessage },
  }: {
    clock: ClockState;
    evas: EVAsState;
    videos: VideosState;
  } = useSelector((store) => store);

  const errorMessages = evasErrorMessage !== "" || videosErrorMessage !== "";

  const isToday = isSameDate(new Date(), new Date(date));

  let lastUpdate = "pending";
  let nextUpdate = "pending";
  const lastCheckedDate = new Date(lastChecked);
  if (!isNaN(lastCheckedDate.valueOf())) {
    lastUpdate =
      lastCheckedDate.toLocaleTimeString("en-us", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
        hour12: false,
      }) + "Z";
    nextUpdate =
      add(lastCheckedDate, FIVE_MINS_MS).toLocaleTimeString("en-us", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
        hour12: false,
      }) + "Z";
  }

  return (
    <div className={`${styles.container} ${errorMessages ? styles.haveErrors : styles.noErrors}`}>
      <span className={styles.playPause}>
        &nbsp;
        {isRunning ? <span style={{ fontSize: "1.3em", lineHeight: "22px" }}>🞂</span> : "❙❙"}
      </span>
      <span className={styles.statusText}>
        {!videosReady.left || !videosReady.right ? <span className={styles.spinner}></span> : " "}
        &nbsp;
        {isToday && (
          <span>
            Last video update: {lastUpdate}
            {videosErrorMessage ? " (failed)" : ""}. Next video update scheduled for: {nextUpdate}{" "}
            |&nbsp;
          </span>
        )}
        <span>IO {videosErrorMessage === "" ? "✓" : "✗"}&nbsp;</span>
        <span>| ISS WIKI {evasErrorMessage === "" ? "✓" : "✗"}&nbsp; &nbsp;</span>
      </span>
    </div>
  );
}
