import { useSelector } from "react-redux";
import deepEqual from "lodash/isEqual";
import { PhotoFile } from "services/io";
import { add, ClockState, isSameDate } from "store/clock";
import { EVAsState } from "store/evas";
import { PhotosState } from "store/photos";
import { VideosState } from "store/videos";
import styles from "./status-bar.module.css";
import { RootState } from "store/index";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function StatusBar() {
  const {
    clock: { isRunning, date },
    evas: { errorMessage: evasErrorMessage },
    videos: { ready: videosReady, lastChecked, errorMessage: videosErrorMessage },
    photos: { ready: photosReady, photosLastChecked, errorMessage: photosErrorMessage },
  }: {
    clock: ClockState;
    evas: EVAsState;
    videos: VideosState;
    photos: PhotosState;
  } = useSelector((store: RootState) => store, deepEqual);

  const errorMessages =
    evasErrorMessage !== "" || videosErrorMessage !== "" || photosErrorMessage !== "";

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
        {!videosReady[1] || !videosReady[2] ? <span className={styles.spinner}></span> : " "}
        &nbsp;
        {isToday && (
          <span>
            Last video update: {lastUpdate}
            {videosErrorMessage ? " (failed)" : ""}. Next video update scheduled for: {nextUpdate}{" "}
            |&nbsp;
          </span>
        )}
        <span>IO {videosErrorMessage === "" && photosErrorMessage === "" ? "✓" : "✗"}&nbsp;</span>
        <span>| ISS WIKI {evasErrorMessage === "" ? "✓" : "✗"}&nbsp; &nbsp;</span>
      </span>
    </div>
  );
}
