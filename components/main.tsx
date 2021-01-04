import { useDispatch, useSelector } from "react-redux";
import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import AVPanels from "components/av-panels";
import { ClockState, start, stop } from "store/clock";
import { VideosState } from "store/videos";

/**
 * Renders the main CODA application layout. Also handles checking whether the clock should be running
 */
export default function Main() {
  // the server shouldn't be running clocks!!!
  if (typeof window !== "undefined") {
    const {
      clock,
      videos,
    }: { clock: ClockState; videos: VideosState } = useSelector(
      (state) => state
    );
    const dispatch = useDispatch();

    // (1) make sure the clock is running when it should

    const everythingReady =
      clock.ready &&
      // just check that all videos are ready
      Object.keys(videos.ready).reduce(
        (prev, curr) => prev && videos.ready[curr],
        true
      );

    // (1.1) the clock is paused when it should be running
    if (everythingReady && !clock.isRunning) {
      dispatch(start());
    }
    // (1.2) the clock is running when it should be paused
    else if (!everythingReady && clock.isRunning) {
      // kill the clock if it should be paused
      dispatch(stop());
    }
  }

  return (
    <div>
      <Header />
      <NavTimeline />
      <AVPanels />
    </div>
  );
}
