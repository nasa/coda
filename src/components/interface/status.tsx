import { deepEqual, useAppSelector } from "utils/useAppSelector";
import styles from "./status.module.css";
import { RootState } from "store/index";
import { useEffect, useState, FunctionComponent } from "react";

const StatusArea: FunctionComponent<{ largeDisplay: boolean }> = ({ largeDisplay }) => {
  const sequences: SequencesState = useAppSelector(
    (state: RootState) => state.sequences,
    deepEqual
  );
  const videos: VideosState = useAppSelector((state: RootState) => state.videos, deepEqual);
  const photos: PhotosState = useAppSelector((state: RootState) => state.photos, deepEqual);
  const gps: GPSState = useAppSelector((state: RootState) => state.gps, deepEqual);
  const ephemera: EphemeraState = useAppSelector((state: RootState) => state.ephemera, deepEqual);
  const transcript: TranscriptState = useAppSelector(
    (state: RootState) => state.transcript,
    deepEqual
  );

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
  const [transcriptStatus, setTranscriptStatus] = useState({
    message: "",
    classname: styles.loading,
  });

  useEffect(() => {
    setVideoStatus(
      createStatus(videos.loadingStatus, videos.responseMetadata, videos.videoFiles?.length > 0)
    );
  }, [videos.loadingStatus, videos.responseMetadata]);

  useEffect(() => {
    setPhotoStatus(
      createStatus(photos.loadingStatus, photos.responseMetadata, photos.photoFiles?.length > 0)
    );
  }, [photos.loadingStatus, photos.responseMetadata]);

  useEffect(() => {
    setSequenceStatus(
      createStatus(
        sequences.loadingStatus,
        sequences.responseMetadata,
        sequences.allSequences?.length > 0
      )
    );
  }, [sequences.loadingStatus, sequences.responseMetadata]);

  useEffect(() => {
    setGpsStatus(createStatus(gps.loadingStatus, gps.responseMetadata, gps.gpsTracks.length > 0));
  }, [gps.loadingStatus, gps.responseMetadata]);

  useEffect(() => {
    setEphemeraStatus(
      createStatus(
        ephemera.loadingStatus,
        ephemera.responseMetadata,
        ephemera.ephemerisFiles?.length > 0
      )
    );
  }, [ephemera.loadingStatus, ephemera.responseMetadata]);
  useEffect(() => {
    let isTranscript = false;
    transcript.transcripts.forEach((transcript) => {
      if (transcript.utterances.length > 0) {
        isTranscript = true;
      }
    });

    setTranscriptStatus(
      createStatus(transcript.loadingStatus, transcript.responseMetadata, isTranscript)
    );
  }, [transcript.loadingStatus, transcript.responseMetadata]);

  if (!largeDisplay) {
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
              <td>Transcript</td>
              <td title={"Transcript " + transcriptStatus.message}>
                <span className={`${styles.status} ${transcriptStatus.classname}`}></span>
              </td>
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
              <td>Transcript</td>
              <td title={"Transcript " + transcriptStatus.message}>
                <span className={`${styles.statusLarge} ${transcriptStatus.classname}`}></span>
              </td>
            </tr>
          </tbody>
        </table>
      </>
    );
  }

  function createStatus(
    loadingStatus: LoadingStatus,
    responseMetadata: ResponseMetadata,
    resultsReturned: boolean
  ): { message: string; classname: string } {
    const cacheTime = responseMetadata?.cachedTimestamp
      ? new Date(responseMetadata.cachedTimestamp).toLocaleString()
      : null;
    let message: string;
    let classname: string;
    if (loadingStatus === "loading") {
      message = "data loading...";
      classname = styles.loading;
    } else if (loadingStatus === "unneeded") {
      message = "data not applicable";
      classname = styles.unneeded;
    } else {
      if (responseMetadata?.retrieverStatus === "error") {
        message = "Error: " + responseMetadata.error;
        classname = styles.error;
        return { message, classname };
      }
      if (!resultsReturned) {
        message = "data is empty";
        classname = styles.unneeded;
        return { message, classname };
      }
      //have data and no error

      message = `data originally retrieved on ${cacheTime}`;
      classname = styles.noError;
      if (responseMetadata?.expiration < new Date().toISOString()) {
        message = `data from cache but expired on: ${new Date(
          responseMetadata.expiration
        ).toLocaleString()}`;
        classname = styles.stale;
      }
    }
    return { message, classname };
  }
};

export default StatusArea;
