import { useSelector } from "react-redux";
import { PlayheadState } from "store/playhead";
import { SequencesEntityState } from "store/sequences";
import { PhotosEntityState } from "store/photos";
import { VideosEntityState } from "store/videos";
import styles from "./status-bar.module.css";
import { RootState } from "store/index";
import { useEffect, useState } from "react";
import { ResMetadata } from "typings";
import { GPSState } from "store/gps";
import { EphemeraEntityState } from "store/ephemera";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function StatusBar() {
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);
  const gps: GPSState = useSelector((state: RootState) => state.gps);
  const ephemera: EphemeraEntityState = useSelector((state: RootState) => state.ephemera);

  const [videoStatus, setVideoStatus] = useState({ status: ".", message: "" });
  const [photoStatus, setPhotoStatus] = useState({ status: ".", message: "" });
  const [sequenceStatus, setSequenceStatus] = useState({ status: ".", message: "" });
  const [gpsStatus, setGpsStatus] = useState({ status: ".", message: "" });
  const [ephemeraStatus, setEphemeraStatus] = useState({ status: ".", message: "" });

  useEffect(() => {
    if (videos.metadata === null) {
      return;
    }
    setVideoStatus(createStatus(videos.metadata, videos.ids.length > 0));
  }, [videos.metadata]);

  useEffect(() => {
    if (photos.metadata === null) {
      return;
    }
    setPhotoStatus(createStatus(photos.metadata, photos.ids.length > 0));
  }, [photos.metadata]);

  useEffect(() => {
    if (sequences.metadata === null) {
      return;
    }
    setSequenceStatus(createStatus(sequences.metadata, sequences.ids.length > 0));
  }, [sequences.metadata]);

  useEffect(() => {
    if (gps.metadata === null) {
      return;
    }
    setGpsStatus(createStatus(gps.metadata, gps.gpsTracks.length > 0));
  }, [gps.metadata]);

  useEffect(() => {
    if (ephemera.metadata === null) {
      return;
    }
    setEphemeraStatus(createStatus(ephemera.metadata, ephemera.ids.length > 0));
  }, [ephemera.metadata]);

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
        <span title={"Video " + videoStatus.message}>Videos:{videoStatus.status}</span> |&nbsp;
        <span title={"Photo " + photoStatus.message}>Photos: {photoStatus.status}</span>] -&nbsp;
        <span title="ISS and Exploration Wikis">WIKI </span>[
        <span title={"EVAs " + sequenceStatus.message}>EVAs: {sequenceStatus.status}</span> |&nbsp;
        <span title={"GPS track " + gpsStatus.message}>GPS: {gpsStatus.status}</span> ] -&nbsp;
        <span title={"Orbit ephemera " + ephemeraStatus.message}>
          Orbit: {ephemeraStatus.status}
        </span>
      </span>
    </div>
  );
}

function createStatus(
  metadata: ResMetadata,
  resultsReturned: boolean
): { status: string; message: string } {
  let status;
  if (metadata.error) {
    status = "✗";
    if (metadata.stale) {
      status = "?";
    }
  } else if (!resultsReturned) {
    status = "_";
  } else {
    status = "✓";
  }

  let message;
  if (metadata.error) {
    message = "Error: " + metadata.error;
  } else if (metadata.fromCache) {
    message = `data from cache (${new Date(metadata.cacheTimestamp).toLocaleString()})`;
  } else if (!resultsReturned) {
    message = "data not returned (without error)";
  } else {
    message = "data is fresh";
  }
  return { status, message };
}
