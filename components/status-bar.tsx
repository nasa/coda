import { useSelector } from "react-redux";
import { PlayheadState } from "store/playhead";
import { SequencesEntityState } from "store/sequences";
import { PhotosEntityState } from "store/photos";
import { VideosEntityState } from "store/videos";
import styles from "./status-bar.module.css";
import { RootState } from "store/index";
import { useEffect, useState } from "react";
import { ResMetadata } from "typings";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function StatusBar() {
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);

  const [videoStatus, setVideoStatus] = useState({ status: ".", message: "" });
  const [photoStatus, setPhotoStatus] = useState({ status: ".", message: "" });
  const [wikiStatus, setWikiStatus] = useState({ status: ".", message: "" });

  useEffect(() => {
    if (videos.metadata === null) {
      return;
    }
    setVideoStatus(createStatus(videos.metadata));
  }, [videos.metadata]);

  useEffect(() => {
    if (photos.metadata === null) {
      return;
    }
    setPhotoStatus(createStatus(photos.metadata));
  }, [photos.metadata]);

  useEffect(() => {
    if (photos.metadata === null) {
      return;
    }
    setWikiStatus(createStatus(sequences.metadata));
  }, [sequences.metadata]);

  return (
    <div className={`${styles.container}`}>
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
        <span title="Imagery Online">IO </span>[
        <span title={"Video " + videoStatus.message}>V:{videoStatus.status}</span> |&nbsp;
        <span title={"Photo " + photoStatus.message}>P: {photoStatus.status}</span>]&nbsp;
        <span title="Wiki">WIKI </span>
        <span title={"Wiki " + wikiStatus.message}>{wikiStatus.status}</span>
      </span>
    </div>
  );
}

function createStatus(metadata: ResMetadata): { status: string; message: string } {
  let status;
  if (metadata.error) {
    status = "✗";
    if (metadata.stale) {
      status = "?";
    }
  } else {
    status = "✓";
  }

  let message;
  if (metadata.error) {
    message = "Error: " + metadata.error;
  } else if (metadata.fromCache) {
    message = `data from cache (${new Date(metadata.cacheTimestamp).toLocaleString()})`;
  } else {
    message = "data is fresh";
  }
  return { status, message };
}
