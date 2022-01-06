import _ from "lodash";
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { run, halt, tick, changeDate, add, changeTime } from "store/playhead";
import useInterval from "utils/useInterval";
import { RootState } from "store/index";

function PlayheadMonitor() {
  const playheadReady = useSelector((state: RootState) => state.playhead.ready);
  const playheadIsRunning = useSelector((state: RootState) => state.playhead.isRunning);
  const playheadDate = useSelector((state: RootState) => state.playhead.date);
  const playheadSeconds = useSelector((state: RootState) => state.playhead.seconds);
  const frames = useSelector((state: RootState) => state.framework.frames);

  const dispatch = useDispatch();

  useEffect(() => {
    // (1) make sure the playhead is running when it should

    let panesAllReady = true;
    for (const frame in frames) {
      if (_.isNil(frames[frame].paneStateData.ready) || !frames[frame].paneStateData.ready) {
        panesAllReady = false;
        break;
      }
    }

    // determine whether all the "modules" are ready, including the user
    const everythingReady = playheadReady && panesAllReady;

    // (1.2) the playhead is paused when it should be running
    if (everythingReady && !playheadIsRunning) {
      dispatch(run());
    }
    // (1.2) the playhead is running when it should be paused
    else if (!everythingReady && playheadIsRunning) {
      // kill the playhead if it should be paused
      dispatch(halt());
    }
  }, [playheadReady, playheadIsRunning, frames]);

  useEffect(() => {
    // check if the date has rolled over into the next UTC day
    if (playheadSeconds >= 60 * 60 * 24) {
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
