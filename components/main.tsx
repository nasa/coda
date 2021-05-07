import { useDispatch, useSelector } from "react-redux";
import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import PlaybackControls from "components/playback-controls";
import StatusBar from "components/status-bar";
import Video from "components/video";
import Photos from "components/photos";
import ISSLocation from "components/iss-location";
import { run, halt, tick } from "store/playhead";
import { PhotosEntityState } from "store/photos";
import { VideosEntityState } from "store/videos";
import useInterval from "utils/useInterval";
import styles from "./main.module.css";
import { useEffect } from "react";
import { RootState } from "store/index";
import type { QueryParams } from "pages/view";
/**
 * Renders the main CODA application layout. Also handles checking whether the playhead should be running
 */
export default function Main(props: { query: QueryParams }) {
  const playheadReady = useSelector((state: RootState) => state.playhead.ready);
  const playheadIsRunning = useSelector((state: RootState) => state.playhead.isRunning);
  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const photos: PhotosEntityState = useSelector((state: RootState) => state.photos);

  const dispatch = useDispatch();

  useEffect(() => {
    // (1) make sure the playhead is running when it should

    // determine whether all the "modules" are ready, including the user
    const everythingReady = playheadReady && videos.ready[1] && videos.ready[2] && photos.ready;

    // (1.2) the playhead is paused when it should be running
    if (everythingReady && !playheadIsRunning) {
      dispatch(run());
    }
    // (1.2) the playhead is running when it should be paused
    else if (!everythingReady && playheadIsRunning) {
      // kill the playhead if it should be paused
      dispatch(halt());
    }
  }, [playheadReady, playheadIsRunning, videos.ready, photos.ready]);

  useInterval(() => {
    if (playheadIsRunning) {
      dispatch(tick());
    }
  }, 1000);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Header />
      </div>
      <div className={styles.body}>
        <div className={styles.bodyRow1}>
          <Video playerID={1} {...props} />
          <Video playerID={2} {...props} />
          <Photos />
        </div>
        <div className={styles.bodyRow2}>
          <div style={{ flex: "1 1 auto" }}>
            <ISSLocation />
          </div>
          <div style={{ flex: "0 1 170px" }}></div>
        </div>
      </div>
      <div className={styles.footer}>
        <PlaybackControls />
        <NavTimeline />
        <StatusBar />
      </div>
    </div>
  );
}
