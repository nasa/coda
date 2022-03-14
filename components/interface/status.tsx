import { useSelector } from "react-redux";
import styles from "./status.module.css";
import { RootState } from "store/index";
import { useEffect, useState } from "react";
import { LoadingStatusEnum } from "utils/enums";

export default function StatusArea(props: { largeDisplay: boolean }) {
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
    setVideoStatus(createStatus(videos.loadingStatus, videos.cacheMetadata, videos.ids.length > 0));
  }, [videos.loadingStatus, videos.cacheMetadata]);

  useEffect(() => {
    setPhotoStatus(createStatus(photos.loadingStatus, photos.cacheMetadata, photos.ids.length > 0));
  }, [photos.loadingStatus, photos.cacheMetadata]);

  useEffect(() => {
    setSequenceStatus(
      createStatus(sequences.loadingStatus, sequences.cacheMetadata, sequences.ids.length > 0)
    );
  }, [sequences.loadingStatus, sequences.cacheMetadata]);

  useEffect(() => {
    setGpsStatus(createStatus(gps.loadingStatus, gps.cacheMetadata, gps.gpsTracks.length > 0));
  }, [gps.loadingStatus, gps.cacheMetadata]);

  useEffect(() => {
    setEphemeraStatus(
      createStatus(ephemera.loadingStatus, ephemera.cacheMetadata, ephemera.ids.length > 0)
    );
  }, [ephemera.loadingStatus, ephemera.cacheMetadata]);

  if (!props.largeDisplay) {
    return (
      <div className={`${styles.container}`}>
        <table className={styles.statusTable}>
          <tbody>
            <tr>
              <td>IO:</td>
              <td>Video</td>
              <td title={"Video " + videoStatus.message}>
                <span className={`${styles.status} ${videoStatus.classname}`}></span>
              </td>
              <td>Photos</td>
              <td title={"Photo " + photoStatus.message}>
                <span className={`${styles.status} ${photoStatus.classname}`}></span>
              </td>
            </tr>
            <tr>
              <td>Wiki:</td>
              <td>Events</td>
              <td title={"EVAs " + sequenceStatus.message}>
                <span className={`${styles.status} ${sequenceStatus.classname}`}></span>
              </td>
              <td>GPS</td>
              <td title={"GPS track " + gpsStatus.message}>
                <span className={`${styles.status} ${gpsStatus.classname}`}></span>
              </td>
            </tr>
            <tr>
              <td>Orbit:</td>
              <td>Ephemeris</td>
              <td title={"Orbit ephemera " + ephemeraStatus.message}>
                <span className={`${styles.status} ${ephemeraStatus.classname}`}></span>
              </td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  } else {
    return (
      <>
        <table className={styles.largeStatusTable}>
          <tbody>
            <tr>
              <td>Imagery Online:</td>
              <td>Video</td>
              <td title={"Video " + videoStatus.message}>
                <span className={`${styles.statusLarge} ${videoStatus.classname}`}></span>
              </td>
              <td>Photos</td>
              <td title={"Photo " + photoStatus.message}>
                <span className={`${styles.statusLarge} ${photoStatus.classname}`}></span>
              </td>
            </tr>
            <tr>
              <td>Wiki:</td>
              <td>Events</td>
              <td title={"EVAs " + sequenceStatus.message}>
                <span className={`${styles.statusLarge} ${sequenceStatus.classname}`}></span>
              </td>
              <td>GPS</td>
              <td title={"GPS track " + gpsStatus.message}>
                <span className={`${styles.statusLarge} ${gpsStatus.classname}`}></span>
              </td>
            </tr>
            <tr>
              <td>Orbit:</td>
              <td>Ephemeris</td>
              <td title={"Orbit ephemera " + ephemeraStatus.message}>
                <span className={`${styles.statusLarge} ${ephemeraStatus.classname}`}></span>
              </td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </>
    );
  }

  function createStatus(
    loadingStatus: LoadingStatusEnum,
    cacheMetadata: CacheMetadata,
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
      if (cacheMetadata?.error) {
        message = "Error: " + cacheMetadata.error;
        classname = styles.error;
      } else if (cacheMetadata?.stale) {
        message = `stale data from cache (${new Date(cacheMetadata.timestamp).toLocaleString()})`;
        classname = styles.stale;
      } else if (!resultsReturned) {
        message = "data not returned (without error)";
        classname = styles.unneeded;
      } else {
        if (cacheMetadata?.fromCache) {
          message = `data from cache (${new Date(cacheMetadata.timestamp).toLocaleString()})`;
        } else {
          message = "data is fresh";
        }
        classname = styles.noError;
      }
    }
    return { message, classname };
  }
}
