import get from "lodash/get";
import deepEqual from "lodash/isEqual";
import isNil from "lodash/isNil";
import paper from "paper";
import { MutableRefObject, useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { PlayheadState, isSameDate, changeTime, changeHoverTime } from "store/playhead";
import {
  evasSelector,
  getActivityPerformanceMissionTime,
  getEVAStartMilliseconds,
  idFromDate,
} from "store/evas";
import { videoSelectors } from "store/videos";
import { photosSelectors } from "store/photos";

import DrawNav from "./nav-timeline-draw";
import { RootState } from "store/index";

/**
 * Renders the navigation timeline presented at the top of the CODA window
 */
function NavTimeline() {
  const {
    playhead,
  }: {
    playhead: PlayheadState;
  } = useSelector((state: RootState) => state, deepEqual);

  const dispatch = useDispatch();
  const storeState = useStore().getState();
  const dayNight = storeState.ephemera.dayNight;

  const videoFiles = videoSelectors.selectAll(storeState);
  const photoFiles = photosSelectors.selectAll(storeState);

  const eva = evasSelector.selectById(storeState, idFromDate(playhead.date));
  const evaName = get(eva, "name", "");
  const time: MutableRefObject<number> = useRef(0);
  const drawNav: MutableRefObject<DrawNav> = useRef(null);
  const mouseOnNavigator: MutableRefObject<boolean> = useRef(false);
  const navReady: MutableRefObject<boolean> = useRef(false);

  let evaStartSec = null as number;
  const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d))$/; // matches valid hh:mm times
  if (!isNil(eva) && !isNil(eva.startTime.match(reHHMM))) {
    const [hh, mm] = eva.startTime.split(":");
    evaStartSec = 3600 * +hh + 60 * +mm;
  }

  const canvas = useRef();

  /** Draw the timeline on the canvas from scratch */
  const installTimeline = () => {
    // only setup the canvas once
    if (isNil(paper.project)) {
      paper.setup(canvas.current);
    }

    const activityPerformance = { EV1: [], EV2: [] };
    if (!isNil(eva)) {
      const activityStartUTCMilliseconds = getEVAStartMilliseconds(eva);
      const EV1 = get(eva.execution, "EV1", null);
      if (!isNil(EV1)) {
        activityPerformance.EV1 = getActivityPerformanceMissionTime(
          EV1,
          eva.startDate,
          activityStartUTCMilliseconds
        );
      }
      const EV2 = get(eva.execution, "EV2", null);
      if (!isNil(EV2)) {
        activityPerformance.EV2 = getActivityPerformanceMissionTime(
          EV2,
          eva.startDate,
          activityStartUTCMilliseconds
        );
      }
    }

    const isToday = isSameDate(new Date(), new Date(playhead.date));

    drawNav.current = new DrawNav(
      videoFiles,
      photoFiles,
      dayNight,
      activityPerformance,
      new Date(playhead.date),
      evaName,
      evaStartSec,
      isToday
    );

    drawNav.current.initGroups();
    drawNav.current.setDynamicWidthVariables();
    drawNav.current.drawTier1();
    drawNav.current.drawTier1NavBox(time.current);
    drawNav.current.drawTier2();

    paper.view.onResize = function () {
      drawNav.current.setDynamicWidthVariables();
      drawNav.current.drawTier1();
      drawNav.current.drawTier1Future();
      drawNav.current.drawTier1NavBox(time.current);
      drawNav.current.drawTier2();
      drawNav.current.drawCursor(time.current);
    };

    paper.view.onMouseMove = (event) => {
      drawNav.current.handleMouseMove(event, time.current, (thisHoverSeconds) => {
        if (!mouseOnNavigator.current) {
          mouseOnNavigator.current = true;
        }
        if (playhead.hoverSeconds !== thisHoverSeconds) {
          dispatch(changeHoverTime(thisHoverSeconds));
        }
      });
    };
    paper.view.onMouseUp = (event) => {
      drawNav.current.handleMouseUp(event, (hh: number, mm: number, ss: number) => {
        const secondsIntoDate = ss + 60 * mm + 3600 * hh;
        dispatch(changeTime(secondsIntoDate));
      });
    };
    paper.view.onMouseLeave = (event) => {
      drawNav.current?.handleMouseLeave(event, () => {
        mouseOnNavigator.current = false;
        drawNav.current.drawTier1NavBox(time.current);
        drawNav.current.drawTier2();
        drawNav.current.drawCursor(time.current);
        dispatch(changeHoverTime(0));
      });
    };

    if (!navReady.current) {
      navReady.current = true;
    }
  };

  useEffect(() => {
    installTimeline();
    return () => paper.project.remove();
  }, [playhead.date]);

  useEffect(() => {
    paper.project.remove();
    installTimeline();
  }, [eva, videoFiles, photoFiles, dayNight]);

  useEffect(() => {
    time.current = playhead.seconds;

    if (!navReady.current) {
      // nothing to update if the paperjs timeline hasn't been instantiated
      return;
    }

    if (!mouseOnNavigator.current) {
      drawNav.current.drawTier1NavBox(time.current);
      drawNav.current.drawTier1Future();
    }
    drawNav.current.drawTier2();
    drawNav.current.drawCursor(time.current);
  }, [playhead.seconds]);

  // the inline style here seems to be a problem because the styles rendered on the server are different than how the client interprets it. doesn't seem to be a big deal
  // https://github.com/vercel/next.js/issues/7322
  return (
    <canvas
      ref={canvas}
      style={{
        // position: "relative",
        // bottom: "0",
        height: "210px",
        width: "100%",
      }}
      data-paper-resize
    />
  );
}

export default NavTimeline;
