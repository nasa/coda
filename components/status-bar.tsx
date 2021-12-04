import { useSelector } from "react-redux";
import { PlayheadState } from "store/playhead";
import { SequencesEntityState } from "store/sequences";
import { PhotosEntityState } from "store/photos";
import { VideosEntityState } from "store/videos";
import styles from "./status-bar.module.css";
import { RootState } from "store/index";
import { useEffect, useState } from "react";
import { LoadingStatusEnum, ResMetadata } from "typings";
import { GPSState } from "store/gps";
import { EphemeraEntityState } from "store/ephemera";

export default function StatusBar() {
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);
  const gps: GPSState = useSelector((state: RootState) => state.gps);
  const ephemera: EphemeraEntityState = useSelector((state: RootState) => state.ephemera);

  const [videoStatus, setVideoStatus] = useState({
    message: "",
    classname: styles.spinner,
  });
  const [photoStatus, setPhotoStatus] = useState({
    message: "",
    classname: styles.spinner,
  });
  const [sequenceStatus, setSequenceStatus] = useState({
    message: "",
    classname: styles.spinner,
  });
  const [gpsStatus, setGpsStatus] = useState({
    message: "",
    classname: styles.spinner,
  });
  const [ephemeraStatus, setEphemeraStatus] = useState({
    message: "",
    classname: styles.spinner,
  });

  useEffect(() => {
    setVideoStatus(createStatus(videos.loadingStatus, videos.metadata, videos.ids.length > 0));
  }, [videos.loadingStatus, videos.metadata]);

  useEffect(() => {
    setPhotoStatus(createStatus(photos.loadingStatus, photos.metadata, photos.ids.length > 0));
  }, [photos.loadingStatus, photos.metadata]);

  useEffect(() => {
    setSequenceStatus(
      createStatus(sequences.loadingStatus, sequences.metadata, sequences.ids.length > 0)
    );
  }, [sequences.loadingStatus, sequences.metadata]);

  useEffect(() => {
    setGpsStatus(createStatus(gps.loadingStatus, gps.metadata, gps.gpsTracks.length > 0));
  }, [gps.loadingStatus, gps.metadata]);

  useEffect(() => {
    setEphemeraStatus(
      createStatus(ephemera.loadingStatus, ephemera.metadata, ephemera.ids.length > 0)
    );
  }, [ephemera.loadingStatus, ephemera.metadata]);

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
        <span>{!videos.ready[1] || !videos.ready[2] ? "Video buffering..." : ""}</span>
        {!videos.ready[1] || !videos.ready[2] ? <span className={styles.spinner}></span> : " "}
        &nbsp;
        <span title="Imagery Online">IO </span>[
        <span title={"Video " + videoStatus.message}>
          Videos: <span className={videoStatus.classname}></span>
        </span>{" "}
        |&nbsp;
        <span title={"Photo " + photoStatus.message}>
          Photos: <span className={photoStatus.classname}></span>
        </span>
        ] -&nbsp;
        <span title="ISS and Exploration Wikis">WIKI </span>[
        <span title={"EVAs " + sequenceStatus.message}>
          EVAs: <span className={sequenceStatus.classname}></span>
        </span>{" "}
        |&nbsp;
        <span title={"GPS track " + gpsStatus.message}>
          GPS: <span className={gpsStatus.classname}></span>
        </span>{" "}
        ] -&nbsp;
        <span title={"Orbit ephemera " + ephemeraStatus.message}>
          Orbit: <span className={ephemeraStatus.classname}></span>
        </span>
      </span>
    </div>
  );

  function createStatus(
    loadingStatus: LoadingStatusEnum,
    metadata: ResMetadata,
    resultsReturned: boolean
  ): { message: string; classname: string } {
    let message;
    let classname;
    if (loadingStatus === LoadingStatusEnum.LOADING) {
      status = "";
      message = "data loading...";
      classname = styles.spinner;
    } else if (loadingStatus === LoadingStatusEnum.UNNEEDED) {
      message = "data unneeded";
      classname = styles.unneeded;
    } else {
      if (metadata.error) {
        status = "✗";
        message = "Error: " + metadata.error;
        classname = styles.error;
      } else if (metadata.stale) {
        status = "✓";
        message = `stale data from cache (${new Date(metadata.cacheTimestamp).toLocaleString()})`;
        classname = styles.stale;
      } else if (!resultsReturned) {
        message = "data not returned (without error)";
        classname = styles.unneeded;
      } else {
        status = "✓";
        if (metadata.fromCache) {
          message = `data from cache (${new Date(metadata.cacheTimestamp).toLocaleString()})`;
        } else {
          message = "data is fresh";
        }
        classname = styles.noError;
      }
    }
    return { message, classname };
  }
}
