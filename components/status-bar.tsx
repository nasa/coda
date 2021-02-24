import { useSelector } from "react-redux";
import deepEqual from "lodash/isEqual";
import { PhotoFile } from "services/io";
import { add, ClockState, isSameDate } from "store/clock";
import { EVAsState } from "store/evas";
import { PhotosState } from "store/photos";
import { VideosState } from "store/videos";
import styles from "./status-bar.module.css";
import { RootState } from "store/index";
import { useEffect, useState } from "react";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function StatusBar() {
  const {
    clock: { isRunning, date },
    evas: { errorMessage: evasErrorMessage, lastChecked: wikiLastChecked, selectedEVA },
    videos: { ready: videosReady, lastChecked: ioLastChecked, errorMessage: videosErrorMessage },
    photos: { ready: photosReady, photosLastChecked, errorMessage: photosErrorMessage },
  }: {
    clock: ClockState;
    evas: EVAsState;
    videos: VideosState;
    photos: PhotosState;
  } = useSelector((store: RootState) => store, deepEqual);

  const errorMessages =
    evasErrorMessage !== "" || videosErrorMessage !== "" || photosErrorMessage !== "";

  const [isToday, setIsToday] = useState(false);
  useEffect(() => {
    setIsToday(isSameDate(new Date(), new Date(date)));
  }, [date]);

  const [lastIOUpdate, setLastIOUpdate] = useState("pending");
  const [nextIOUpdate, setNextIOUpdate] = useState("pending");
  const ioStatusUpdate = () => {
    const lastCheckedDate = new Date(ioLastChecked);
    if (!isNaN(lastCheckedDate.valueOf())) {
      const lastUpdate =
        lastCheckedDate.toLocaleTimeString("en-us", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "UTC",
          hour12: false,
        }) + "Z";
      const nextUpdate =
        add(lastCheckedDate, FIVE_MINS_MS).toLocaleTimeString("en-us", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "UTC",
          hour12: false,
        }) + "Z";

      setLastIOUpdate(lastUpdate);
      setNextIOUpdate(nextUpdate);
    }
  };
  useEffect(ioStatusUpdate, [ioLastChecked]);

  const [lastWikiUpdate, setLastWikiUpdate] = useState("pending");
  const [nextWikiUpdate, setNextWikiUpdate] = useState("pending");
  const wikiStatusUpdate = () => {
    const lastCheckedDate = new Date(wikiLastChecked);
    if (!isNaN(lastCheckedDate.valueOf())) {
      const lastUpdate =
        lastCheckedDate.toLocaleTimeString("en-us", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "UTC",
          hour12: false,
        }) + "Z";
      const nextUpdate =
        add(lastCheckedDate, FIVE_MINS_MS).toLocaleTimeString("en-us", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "UTC",
          hour12: false,
        }) + "Z";

      setLastWikiUpdate(lastUpdate);
      setNextWikiUpdate(nextUpdate);
    }
  };
  useEffect(wikiStatusUpdate, [wikiLastChecked]);

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
            Last video update: {lastIOUpdate}
            {videosErrorMessage ? " (failed)" : ""}. Next video update scheduled for: {nextIOUpdate}{" "}
            |&nbsp;
          </span>
        )}
        {selectedEVA !== "" && (
          <span>
            Last wiki update: {lastWikiUpdate}
            {evasErrorMessage ? " (failed)" : ""}. Next wiki update scheduled for: {nextWikiUpdate}{" "}
            |&nbsp;
          </span>
        )}
        <span title={["IO Status", videosErrorMessage || photosErrorMessage || "Good"].join(" | ")}>
          IO {videosErrorMessage === "" && photosErrorMessage === "" ? "✓" : "✗"}&nbsp;
        </span>
        <span title={["Wiki Status", evasErrorMessage || "Good"].join(" | ")}>
          | ISS WIKI {evasErrorMessage === "" ? "✓" : "✗"}&nbsp; &nbsp;
        </span>
      </span>
    </div>
  );
}
