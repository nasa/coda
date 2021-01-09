import { useDispatch, useSelector } from "react-redux";
import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import StatusBar from "components/status-bar";
import Videos from "components/videos";
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

    // determine whether all the "modules" are ready, including the user
    const everythingReady = clock.ready;
    // clock.ready && videos.ready.right && videos.ready.left;

    // (1.2) the clock is paused when it should be running
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
      <Videos />
      <NavTimeline />
      <StatusBar />
    </div>
  );
}
