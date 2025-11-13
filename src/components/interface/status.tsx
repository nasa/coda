import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import styles from "./status.module.css";
import { RootState } from "store/index";
import { useEffect, useState, FunctionComponent } from "react";
import { isDataTypeValidForSource } from "utils/sourceDataTypeMap";

const StatusArea: FunctionComponent<{ largeDisplay: boolean }> = ({ largeDisplay }) => {
  const source = useAppSelector((state: RootState) => state.framework.source, refEqual);
  const sequences: SequencesState = useAppSelector(
    (state: RootState) => state.sequences,
    deepEqual
  );
  const videos: VideosState = useAppSelector((state: RootState) => state.videos, deepEqual);
  const photos: PhotosState = useAppSelector((state: RootState) => state.photos, deepEqual);
  const gps: GPSState = useAppSelector((state: RootState) => state.gps, deepEqual);
  const ephemera: EphemeraState = useAppSelector((state: RootState) => state.ephemera, deepEqual);
  const dayNight: DayNightState = useAppSelector((state: RootState) => state.dayNight, deepEqual);
  const transcript: TranscriptState = useAppSelector(
    (state: RootState) => state.transcript,
    deepEqual
  );
  const sgAudio: SgAudioState = useAppSelector((state: RootState) => state.sgAudio, deepEqual);
  const graphs: GraphsState = useAppSelector((state: RootState) => state.graphs, deepEqual);

  const [videoStatusIo, setVideoStatusIo] = useState({
    message: "",
    classname: styles.loading,
  });
  const [videoStatusMtx, setVideoStatusMtx] = useState({
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
  const [sgAudioStatus, setSgAudioStatus] = useState({
    message: "",
    classname: styles.loading,
  });
  const [graphStatus, setGraphStatus] = useState({
    message: "",
    classname: styles.loading,
  });
  const [dayNightStatus, setDayNightStatus] = useState({
    message: "",
    classname: styles.loading,
  });

  useEffect(() => {
    setVideoStatusIo(createStatus(videos.metadataIo, videos.videoFiles?.length > 0));
  }, [videos.metadataIo]);

  useEffect(() => {
    setVideoStatusMtx(
      createStatus(
        videos.metadataMtx,
        videos.mtxHlsEndpoints?.length > 0 || Object.keys(videos.mtxPlaybackAvailability).length > 0
      )
    );
  }, [videos.metadataMtx, videos.mtxHlsEndpoints, videos.mtxPlaybackAvailability]);

  useEffect(() => {
    setPhotoStatus(createStatus(photos.metadata, photos.photoFiles?.length > 0));
  }, [photos.metadata]);

  useEffect(() => {
    setSequenceStatus(createStatus(sequences.metadata, sequences.allSequences?.length > 0));
  }, [sequences.metadata]);

  useEffect(() => {
    setGpsStatus(createStatus(gps.metadata, gps.gpsTracks.length > 0));
  }, [gps.metadata]);

  useEffect(() => {
    setEphemeraStatus(createStatus(ephemera.metadata, ephemera.ephemerisFiles?.length > 0));
  }, [ephemera.metadata]);
  useEffect(() => {
    let isTranscript = false;
    transcript.transcripts.forEach((transcript) => {
      if (transcript.utterances.length > 0) {
        isTranscript = true;
      }
    });

    setTranscriptStatus(createStatus(transcript.metadata, isTranscript));
  }, [transcript.metadata]);

  useEffect(() => {
    const hasSgAudio = sgAudio.sgActivityFullUrlRecord?.sgActivityRangeFullUrlRecords?.length > 0;
    setSgAudioStatus(createStatus(sgAudio.metadata, hasSgAudio));
  }, [sgAudio.metadata]);

  useEffect(() => {
    const hasGraphs = graphs.graphsManifest?.graphs?.length > 0;
    setGraphStatus(createStatus(graphs.metadata, hasGraphs));
  }, [graphs.metadata]);

  useEffect(() => {
    const hasDayNight = dayNight.dayNight?.length > 0;
    setDayNightStatus(createStatus(dayNight.metadata, hasDayNight));
  }, [dayNight.metadata]);

  if (!largeDisplay) {
    const dataTypes = [];

    if (isDataTypeValidForSource(source, "mtxvideo")) {
      dataTypes.push({
        label: "Live Video",
        status: videoStatusMtx,
        title: "Live Video " + videoStatusMtx.message,
      });
    }
    if (isDataTypeValidForSource(source, "videos")) {
      dataTypes.push({
        label: "IO Video",
        status: videoStatusIo,
        title: "Video " + videoStatusIo.message,
      });
    }
    if (isDataTypeValidForSource(source, "photos")) {
      dataTypes.push({
        label: "IO Photos",
        status: photoStatus,
        title: "Photo " + photoStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "wikiEvas")) {
      dataTypes.push({
        label: "EVAs",
        status: sequenceStatus,
        title: "EVAs " + sequenceStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "wikiTestEvents")) {
      dataTypes.push({
        label: "Events",
        status: sequenceStatus,
        title: "Events " + sequenceStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "gpstracks")) {
      dataTypes.push({ label: "GPS", status: gpsStatus, title: "GPS track " + gpsStatus.message });
    }
    if (isDataTypeValidForSource(source, "ephemeris")) {
      dataTypes.push({
        label: "Ephemeris",
        status: ephemeraStatus,
        title: "Orbit ephemera " + ephemeraStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "daynight")) {
      dataTypes.push({
        label: "Day/Night",
        status: dayNightStatus,
        title: "Day/Night " + dayNightStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "transcript")) {
      dataTypes.push({
        label: "Transcript",
        status: transcriptStatus,
        title: "Transcript " + transcriptStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "sgaudio")) {
      dataTypes.push({
        label: "SG Audio",
        status: sgAudioStatus,
        title: "SG Audio " + sgAudioStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "graph")) {
      dataTypes.push({
        label: "Graphs",
        status: graphStatus,
        title: "Graphs " + graphStatus.message,
      });
    }

    const rows = [];
    for (let i = 0; i < dataTypes.length; i += 3) {
      const row = dataTypes.slice(i, i + 3);
      rows.push(row);
    }

    return (
      <div className={`${styles.container}`}>
        <div className={styles.statusGrid}>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className={styles.statusRow}>
              {row.map((item, colIndex) => (
                <div key={`item-${rowIndex}-${colIndex}`} className={styles.statusItem}>
                  <span className={styles.statusLabel}>{item.label}</span>
                  <span
                    className={`${styles.status} ${item.status.classname}`}
                    title={item.title}
                  ></span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    const dataTypes = [];

    if (isDataTypeValidForSource(source, "mtxvideo")) {
      dataTypes.push({
        label: "Live Video",
        status: videoStatusMtx,
        title: "Live Video " + videoStatusMtx.message,
      });
    }
    if (isDataTypeValidForSource(source, "videos")) {
      dataTypes.push({
        label: "IO Video",
        status: videoStatusIo,
        title: "Video " + videoStatusIo.message,
      });
    }
    if (isDataTypeValidForSource(source, "photos")) {
      dataTypes.push({
        label: "IO Photos",
        status: photoStatus,
        title: "Photo " + photoStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "wikiEvas")) {
      dataTypes.push({
        label: "EVAs",
        status: sequenceStatus,
        title: "EVAs " + sequenceStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "wikiTestEvents")) {
      dataTypes.push({
        label: "Events",
        status: sequenceStatus,
        title: "Events " + sequenceStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "gpstracks")) {
      dataTypes.push({ label: "GPS", status: gpsStatus, title: "GPS track " + gpsStatus.message });
    }
    if (isDataTypeValidForSource(source, "ephemeris")) {
      dataTypes.push({
        label: "Ephemeris",
        status: ephemeraStatus,
        title: "Orbit ephemera " + ephemeraStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "daynight")) {
      dataTypes.push({
        label: "Day/Night",
        status: dayNightStatus,
        title: "Day/Night " + dayNightStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "transcript")) {
      dataTypes.push({
        label: "Transcript",
        status: transcriptStatus,
        title: "Transcript " + transcriptStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "sgaudio")) {
      dataTypes.push({
        label: "SG Audio",
        status: sgAudioStatus,
        title: "SG Audio " + sgAudioStatus.message,
      });
    }
    if (isDataTypeValidForSource(source, "graph")) {
      dataTypes.push({
        label: "Graphs",
        status: graphStatus,
        title: "Graphs " + graphStatus.message,
      });
    }

    const rows = [];
    for (let i = 0; i < dataTypes.length; i += 3) {
      const row = dataTypes.slice(i, i + 3);
      rows.push(row);
    }

    return (
      <>
        <div className={styles.largeStatusGrid}>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className={styles.largeStatusRow}>
              {row.map((item, colIndex) => (
                <div key={`item-${rowIndex}-${colIndex}`} className={styles.largeStatusItem}>
                  <span className={styles.largeStatusLabel}>{item.label}</span>
                  <span
                    className={`${styles.statusLarge} ${item.status.classname}`}
                    title={item.title}
                  ></span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  function createStatus(
    metadata: FetchMetadata | null,
    resultsReturned: boolean
  ): { message: string; classname: string } {
    const cacheTime = metadata?.timestamp ? new Date(metadata.timestamp).toLocaleString() : null;
    let message: string;
    let classname: string;

    // If no metadata yet, we're still loading
    if (!metadata) {
      message = "data loading...";
      classname = styles.loading;
      return { message, classname };
    }

    // Check if this data type is not applicable for the current source
    if (metadata.unneeded) {
      message = "data not applicable";
      classname = styles.unneeded;
      return { message, classname };
    }

    // Check for errors
    if (metadata && !metadata.success) {
      message = "Error: " + (metadata.error || "unknown error");
      classname = styles.error;
      return { message, classname };
    }

    // If we have metadata and no error, but no results, data is empty
    if (!resultsReturned) {
      message = "data is empty";
      classname = styles.unneeded;
      return { message, classname };
    }

    // Have data and no error
    message = cacheTime ? `data originally retrieved on ${cacheTime}` : "data available";
    classname = styles.noError;

    return { message, classname };
  }
};

export default StatusArea;
