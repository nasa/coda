import { useDispatch, useSelector, useStore } from "react-redux";
import deepEqual from "lodash/isEqual";
import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import PlaybackControls from "components/playback-controls";
import StatusBar from "components/status-bar";
import Video from "components/video";
import Photos from "components/photos";
import ISSLocation from "components/iss-location";
import { PlayheadState, run, halt, tick } from "store/playhead";
import { PhotosState, photosSelectors } from "store/photos";
import { VideosState, videoSelectors } from "store/videos";
import useInterval from "utils/useInterval";
import styles from "./main.module.css";
import { useEffect } from "react";
import { RootState } from "store/index";

/**
 * Renders the main CODA application layout. Also handles checking whether the playhead should be running
 */
export default function Main() {
  const {
    playhead,
    videos,
    photos,
  }: { playhead: PlayheadState; videos: VideosState; photos: PhotosState } = useSelector(
    (state: RootState) => state,
    deepEqual
  );
  const dispatch = useDispatch();
  const store = useStore();
  const videoFiles = videoSelectors.selectAll(store.getState());
  const photoFiles = photosSelectors.selectAll(store.getState());

  useEffect(() => {
    // (1) make sure the playhead is running when it should

    // determine whether all the "modules" are ready, including the user
    const everythingReady = playhead.ready && videos.ready[1] && videos.ready[2] && photos.ready;

    // (1.2) the playhead is paused when it should be running
    if (everythingReady && !playhead.isRunning) {
      dispatch(run());
    }
    // (1.2) the playhead is running when it should be paused
    else if (!everythingReady && playhead.isRunning) {
      // kill the playhead if it should be paused
      dispatch(halt());
    }
  }, [playhead.ready, playhead.isRunning, videos.ready, photos.ready]);

  useInterval(() => {
    if (playhead.isRunning) {
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
          <Video playerID={1} />
          <Video playerID={2} />
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
