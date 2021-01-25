import { useDispatch, useSelector } from "react-redux";
import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import PlaybackControls from "components/playback-controls";
import StatusBar from "components/status-bar";
import Videos from "components/videos";
import { ClockState, run, halt } from "store/clock";
import { VideosState } from "store/videos";

import styles from "./main.module.css";

/**
 * Renders the main CODA application layout. Also handles checking whether the clock should be running
 */
export default function Main() {
  const { clock, videos }: { clock: ClockState; videos: VideosState } = useSelector(
    (state) => state
  );

  // the server shouldn't be running clocks!!!
  if (typeof window !== "undefined") {
    const dispatch = useDispatch();

    // (1) make sure the clock is running when it should

    // determine whether all the "modules" are ready, including the user
    const everythingReady = clock.ready && videos.ready.right && videos.ready.left;

    // (1.2) the clock is paused when it should be running
    if (everythingReady && !clock.isRunning) {
      dispatch(run());
    }
    // (1.2) the clock is running when it should be paused
    else if (!everythingReady && clock.isRunning) {
      // kill the clock if it should be paused
      dispatch(halt());
    }
  }

  // TODO: would be cool to listen to onKeyDown for the spacebar to play/pause

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Header />
      </div>
      <div className={styles.body}>
        <Videos />
      </div>
      <div className={styles.footer}>
        <PlaybackControls />
        {Object.keys(videos.videos).length > 0 && <NavTimeline />}
        <StatusBar />
      </div>
    </div>
  );
}
