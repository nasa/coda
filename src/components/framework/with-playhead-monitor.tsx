import _ from "lodash";
import React, { useEffect } from "react";
import { shallowEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { run, halt, tick, changeDate, changeTime } from "store/playhead";
import useInterval from "utils/useInterval";
import { RootState } from "store/index";
import { addMs } from "../../utils/date";

function PlayheadMonitor() {
  const playheadReady = useAppSelector((state: RootState) => state.playhead.ready, refEqual);
  const playheadIsRunning = useAppSelector(
    (state: RootState) => state.playhead.isRunning,
    refEqual
  );
  const playheadDate = useAppSelector((state: RootState) => state.playhead.date, refEqual);
  const playheadSeconds = useAppSelector((state: RootState) => state.playhead.seconds, refEqual);
  const frames = useAppSelector((state: RootState) => state.framework.frames, shallowEqual);

  const dispatch = useAppDispatch();

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
      const tomorrow = addMs(today, 1000 * 60 * 60 * 24);
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
