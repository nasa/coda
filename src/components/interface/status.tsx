import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import styles from "./status.module.css";
import { useMemo, FunctionComponent } from "react";
import {
  isDataTypeValidForSource,
  isDateValidForMtxVideo,
  mtxVideoMaxAgeDays,
} from "utils/sourceDataTypeMap";

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

const StatusArea: FunctionComponent<{ largeDisplay: boolean }> = ({ largeDisplay }) => {
  const source = useAppSelector((state) => state.framework.source, refEqual);
  const clockDate = useAppSelector((state) => state.clock.date, refEqual);
  const sequences: SequencesState = useAppSelector((state) => state.sequences, deepEqual);
  const videos: VideosState = useAppSelector((state) => state.videos, deepEqual);
  const photos: PhotosState = useAppSelector((state) => state.photos, deepEqual);
  const gps: GPSState = useAppSelector((state) => state.gps, deepEqual);
  const ephemera: EphemeraState = useAppSelector((state) => state.ephemera, deepEqual);
  const dayNight: DayNightState = useAppSelector((state) => state.dayNight, deepEqual);
  const graphs: GraphsState = useAppSelector((state) => state.graphs, deepEqual);
  const talkybot: TalkybotState = useAppSelector((state) => state.talkybot, deepEqual);

  const videoStatusIo = useMemo(
    () => createStatus(videos.metadataIo, videos.videoFiles?.length > 0),
    [videos.metadataIo, videos.videoFiles?.length]
  );

  const videoStatusMtx = useMemo(
    () =>
      createStatus(
        videos.metadataMtx,
        videos.mtxHlsEndpoints?.length > 0 || Object.keys(videos.mtxPlaybackAvailability).length > 0
      ),
    [videos.metadataMtx, videos.mtxHlsEndpoints?.length, videos.mtxPlaybackAvailability]
  );

  const photoStatus = useMemo(
    () => createStatus(photos.metadata, photos.photoFiles?.length > 0),
    [photos.metadata, photos.photoFiles?.length]
  );

  const sequenceStatus = useMemo(
    () => createStatus(sequences.metadata, sequences.allSequences?.length > 0),
    [sequences.metadata, sequences.allSequences?.length]
  );

  const gpsStatus = useMemo(
    () => createStatus(gps.metadata, gps.gpsTracks.length > 0),
    [gps.metadata, gps.gpsTracks.length]
  );

  const ephemeraStatus = useMemo(
    () => createStatus(ephemera.metadata, ephemera.ephemerisFiles?.length > 0),
    [ephemera.metadata, ephemera.ephemerisFiles?.length]
  );

  const graphStatus = useMemo(
    () => createStatus(graphs.metadata, (graphs.graphsManifest?.graphs?.length ?? 0) > 0),
    [graphs.metadata, graphs.graphsManifest?.graphs?.length]
  );

  const dayNightStatus = useMemo(
    () => createStatus(dayNight.metadata, dayNight.dayNight?.length > 0),
    [dayNight.metadata, dayNight.dayNight?.length]
  );

  const talkybotStatus = useMemo(
    () => createStatus(talkybot.metadata, talkybot.audioFiles?.length > 0),
    [talkybot.metadata, talkybot.audioFiles?.length]
  );

  if (!largeDisplay) {
    const dataTypes = [];

    // Status for date being too old for live video
    const liveVideoDateTooOld = !isDateValidForMtxVideo(clockDate, mtxVideoMaxAgeDays);
    const liveVideoUnneededStatus = {
      message: "not available for dates > 7 days ago",
      classname: styles.unneeded,
    };

    if (isDataTypeValidForSource(source, "mtxvideo")) {
      dataTypes.push({
        label: "EMSS Video",
        status: liveVideoDateTooOld ? liveVideoUnneededStatus : videoStatusMtx,
        title:
          "EMSS Video " +
          (liveVideoDateTooOld ? liveVideoUnneededStatus.message : videoStatusMtx.message),
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
    if (isDataTypeValidForSource(source, "talkybot")) {
      dataTypes.push({
        label: "Talkybot",
        status: talkybotStatus,
        title: "Talkybot " + talkybotStatus.message,
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

    // Status for date being too old for live video
    const liveVideoDateTooOld = !isDateValidForMtxVideo(clockDate, mtxVideoMaxAgeDays);
    const liveVideoUnneededStatus = {
      message: "not available for dates > 7 days ago",
      classname: styles.unneeded,
    };

    if (isDataTypeValidForSource(source, "mtxvideo")) {
      dataTypes.push({
        label: "EMSS Video",
        status: liveVideoDateTooOld ? liveVideoUnneededStatus : videoStatusMtx,
        title:
          "EMSS Video " +
          (liveVideoDateTooOld ? liveVideoUnneededStatus.message : videoStatusMtx.message),
      });
    }
    if (isDataTypeValidForSource(source, "videos")) {
      dataTypes.push({
        label: "IO Video",
        status: videoStatusIo,
        title: "IO Video " + videoStatusIo.message,
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
    if (isDataTypeValidForSource(source, "talkybot")) {
      dataTypes.push({
        label: "Talkybot",
        status: talkybotStatus,
        title: "Talkybot " + talkybotStatus.message,
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
};

export default StatusArea;
