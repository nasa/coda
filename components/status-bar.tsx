import { useSelector } from "react-redux";
import styles from "./status-bar.module.css";
import { RootState } from "store/index";
import { useEffect, useState } from "react";
import { GPSState } from "store/gps";
import { LoadingStatusEnum } from "utils/enums";

export default function StatusBar() {
  const sequences: SequencesEntityState = useSelector((state: RootState) => state.sequences);
  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);
  const gps: GPSState = useSelector((state: RootState) => state.gps);
  const ephemera: EphemeraEntityState = useSelector((state: RootState) => state.ephemera);

  const [videoStatus, setVideoStatus] = useState({
    message: "",
    classname: styles.loading,
  });
  const [photoStatus, setPhotoStatus] = useState({
    message: "",
    classname: styles.loading,
  });
  const [sequenceStatus, setSequenceStatus] = useState({
    message: "",
    classname: styles.loading,
  });
  const [gpsStatus, setGpsStatus] = useState({
    message: "",
    classname: styles.loading,
  });
  const [ephemeraStatus, setEphemeraStatus] = useState({
    message: "",
    classname: styles.loading,
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
      <span></span>
      <div className={styles.statusText}>
        <div className={styles.service}>
          {!videos.ready[1] || !videos.ready[2] ? "Video buffering..." : ""}
        </div>
        <div className={styles.service} title="Imagery Online">
          <div className={styles.serviceTitle}>IO</div>
          <div className={styles.subservice} title={"Video " + videoStatus.message}>
            Videos:<div className={`${styles.status} ${videoStatus.classname}`}></div>
          </div>
          <div className={styles.subservice} title={"Photo " + photoStatus.message}>
            Photos:<div className={`${styles.status} ${photoStatus.classname}`}></div>
          </div>
        </div>
        <div className={styles.service} title="ISS and Exploration Wikis">
          <div className={styles.serviceTitle}>WIKI</div>

          <div className={styles.subservice} title={"EVAs " + sequenceStatus.message}>
            EVAs:<div className={`${styles.status} ${sequenceStatus.classname}`}></div>
          </div>
          <div className={styles.subservice} title={"GPS track " + gpsStatus.message}>
            GPS:<div className={`${styles.status} ${gpsStatus.classname}`}></div>
          </div>
        </div>
        <div className={styles.service} title={"Orbit ephemera " + ephemeraStatus.message}>
          <div className={styles.serviceTitle}>Orbit:</div>
          <div className={`${styles.status} ${ephemeraStatus.classname}`}></div>
        </div>
      </div>
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
      message = "data loading...";
      classname = styles.loading;
    } else if (loadingStatus === LoadingStatusEnum.UNNEEDED) {
      message = "data unneeded";
      classname = styles.unneeded;
    } else {
      if (metadata.error) {
        message = "Error: " + metadata.error;
        classname = styles.error;
      } else if (metadata.stale) {
        message = `stale data from cache (${new Date(metadata.cacheTimestamp).toLocaleString()})`;
        classname = styles.stale;
      } else if (!resultsReturned) {
        message = "data not returned (without error)";
        classname = styles.unneeded;
      } else {
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
