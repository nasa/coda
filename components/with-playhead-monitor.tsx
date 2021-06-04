import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { run, halt, tick, changeDate, add, changeTime } from "store/playhead";
import { PhotosEntityState } from "store/photos";
import { VideosEntityState } from "store/videos";
import useInterval from "utils/useInterval";
import { RootState } from "store/index";

function PlayheadMonitor() {
  const playheadReady = useSelector((state: RootState) => state.playhead.ready);
  const playheadIsRunning = useSelector((state: RootState) => state.playhead.isRunning);
  const playheadDate = useSelector((state: RootState) => state.playhead.date);
  const playheadSeconds = useSelector((state: RootState) => state.playhead.seconds);
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

  useEffect(() => {
    // see if the page needs to change
    if (playheadSeconds >= 60 * 60 * 24) {
      // the playhead has rolled over into the next day
      const today = new Date(playheadDate);
      const tomorrow = add(today, 1000 * 60 * 60 * 24);
      dispatch(changeDate(tomorrow.toISOString()));
      dispatch(changeTime(0));
    }
  }, [playheadSeconds]);

  useInterval(() => {
    if (playheadIsRunning) {
      dispatch(tick());
    }
  }, 1000);

  return <></>;
}

/** Higher order component that runs the timeline without causing rerender side-effects */
export default function WithPlayheadMonitor<P>(Component: React.ComponentType<P>) {
  return ({ ...props }) => {
    return (
      <>
        <PlayheadMonitor />
        <Component {...(props as P)} />
      </>
    );
  };
}
