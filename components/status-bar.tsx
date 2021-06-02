import { useSelector } from "react-redux";
import isNull from "lodash/isNull";
import { add, PlayheadState, isSameDate } from "store/playhead";
import { SequencesEntityState, sequencesSelector, idFromDate } from "store/sequences";
import { PhotosEntityState } from "store/photos";
import { VideosEntityState } from "store/videos";
import styles from "./status-bar.module.css";
import { RootState } from "store/index";
import { useEffect, useState } from "react";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function StatusBar() {
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const evas: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);

  const errorMessages =
    evas.errorMessage !== "" || videos.errorMessage !== "" || photos.errorMessage !== "";

  const eva = sequencesSelector.selectById(evas, idFromDate(playhead.date));

  const [isToday, setIsToday] = useState(false);
  useEffect(() => {
    setIsToday(isSameDate(new Date(), new Date(playhead.date)));
  }, [playhead.date]);

  const [lastIOUpdate, setLastIOUpdate] = useState("pending");
  const [nextIOUpdate, setNextIOUpdate] = useState("pending");
  const ioStatusUpdate = () => {
    const lastCheckedDate = new Date(videos.lastChecked);
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
  useEffect(ioStatusUpdate, [videos.lastChecked]);

  const [lastWikiUpdate, setLastWikiUpdate] = useState("pending");
  const [nextWikiUpdate, setNextWikiUpdate] = useState("pending");
  const wikiStatusUpdate = () => {
    const lastCheckedDate = new Date(evas.lastChecked);
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
  useEffect(wikiStatusUpdate, [evas.lastChecked]);

  return (
    <div className={`${styles.container} ${errorMessages ? styles.haveErrors : styles.noErrors}`}>
      <span className={styles.playPause}>
        &nbsp;
        {playhead.isRunning ? (
          <span style={{ fontSize: "1.3em", lineHeight: "22px" }}>🞂</span>
        ) : (
          "❙❙"
        )}
      </span>
      <span className={styles.statusText}>
        {!videos.ready[1] || !videos.ready[2] ? <span className={styles.spinner}></span> : " "}
        &nbsp;
        {isToday && (
          <span>
            Last video update: {lastIOUpdate}
            {videos.errorMessage ? " (failed)" : ""}. Next video update scheduled for:{" "}
            {nextIOUpdate} |&nbsp;
          </span>
        )}
        {!isNull(eva) && (
          <span>
            Last wiki update: {lastWikiUpdate}
            {evas.errorMessage ? " (failed)" : ""}. Next wiki update scheduled for: {nextWikiUpdate}{" "}
            |&nbsp;
          </span>
        )}
        <span
          title={["IO Status", videos.errorMessage || photos.errorMessage || "Good"].join(" | ")}
        >
          IO {videos.errorMessage === "" && photos.errorMessage === "" ? "✓" : "✗"}&nbsp;
        </span>
        <span title={["Wiki Status", evas.errorMessage || "Good"].join(" | ")}>
          | ISS WIKI {evas.errorMessage === "" ? "✓" : "✗"}&nbsp; &nbsp;
        </span>
      </span>
    </div>
  );
}
