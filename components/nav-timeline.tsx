import get from "lodash/get";
import isNull from "lodash/isNull";
import paper from "paper";
import { MutableRefObject, useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ClockState, getApplicationUTC, getMissionTime, isSameDate, set } from "store/clock";
import {
  evaSelector,
  EVAsState,
  getActivityPerformanceMissionTime,
  getEVAStartMilliseconds,
  selectEVAStartMilliseconds,
} from "store/evas";
import { selectVideoFiles, selectVideoTimingData, VideosState } from "store/videos";
import useInterval from "utils/useInterval";
import DrawNav from "./nav-timeline-draw";

// these vars only affect the canvas so avoid updating the React component state
let missionTime = null;
let mouseOnNavigator = false;
let navReady = false;

/**
 * Renders the navigation timeline presented at the top of the CODA window
 */
function NavTimeline() {
  const store = useStore();
  const {
    clock,
    evas,
    videos,
  }: {
    clock: ClockState;
    evas: EVAsState;
    videos: VideosState;
  } = useSelector((state) => state);
  const dispatch = useDispatch();
  const timingData = selectVideoTimingData(videos);
  const videoFiles = selectVideoFiles(videos);

  const eva = evaSelector(evas);
  const canvas = useRef();
  const drawNav: MutableRefObject<DrawNav> = useRef(null);

  useEffect(() => {
    // only setup the canvas once
    if (isNull(paper.project)) {
      paper.setup(canvas.current);
    }

    const paperRendered = !isNull(paper.project) && !paper.project.isEmpty();
    const sameVideos =
      !isNull(drawNav.current) && drawNav.current.hasAlreadyRenderedVideos(videoFiles);
    const sameDate =
      !isNull(drawNav.current) &&
      isSameDate(drawNav.current.dateRendered, new Date(clock.applicationTime));
    const sameEVA = !isNull(drawNav.current) && evas.selectedEVA === drawNav.current.evaRendered;

    // clock.applicationTime is a day off???

    if (paperRendered && sameVideos && sameDate && sameEVA) {
      // bail if there's no reason to rerender the timeline
      return;
    }

    // clear out the timeline before rerendering
    // paper.project.clear();

    const dayNight = eva?.dayNight || null;

    const activityPerformance = { EV1: [], EV2: [] };
    if (!isNull(eva)) {
      const activityStartUTCMilliseconds = getEVAStartMilliseconds(eva);
      const EV1 = get(eva.execution, "EV1", null);
      if (!isNull(EV1)) {
        activityPerformance.EV1 = getActivityPerformanceMissionTime(
          EV1,
          timingData,
          activityStartUTCMilliseconds
        );
      }
      const EV2 = get(eva.execution, "EV2", null);
      if (!isNull(EV2)) {
        activityPerformance.EV2 = getActivityPerformanceMissionTime(
          EV2,
          timingData,
          activityStartUTCMilliseconds
        );
      }
    }

    const isToday = isSameDate(new Date(), new Date(clock.applicationTime));

    drawNav.current = new DrawNav(
      timingData,
      videoFiles,
      dayNight,
      activityPerformance,
      new Date(clock.applicationTime),
      evas.selectedEVA,
      isToday
    );

    drawNav.current.initGroups();
    drawNav.current.setDynamicWidthVariables();
    drawNav.current.drawTier1();
    drawNav.current.drawTier1NavBox(missionTime);
    drawNav.current.drawTier2();

    paper.view.onResize = function () {
      drawNav.current.setDynamicWidthVariables();
      drawNav.current.drawTier1();
      drawNav.current.drawTier1NavBox(missionTime);
      drawNav.current.drawTier2();
      drawNav.current.drawCursor(missionTime);
    };

    paper.view.onMouseMove = (event) => {
      const missionTime = getMissionTime(clock);
      drawNav.current?.handleMouseMove(event, missionTime, () => {
        if (!mouseOnNavigator) {
          mouseOnNavigator = true;
        }
      });
    };
    paper.view.onMouseUp = (event) => {
      drawNav.current.handleMouseUp(event, (hh: number, mm: number, ss: number) => {
        const utc = getApplicationUTC(clock);
        const Y = utc.getUTCFullYear();
        const M = utc.getUTCMonth();
        const D = utc.getUTCDate();

        const dt = new Date(Date.UTC(Y, M, D, hh, mm, ss));
        dispatch(set(dt.toISOString()));
      });
    };
    paper.view.onMouseLeave = (event) => {
      drawNav.current?.handleMouseLeave(event, () => {
        mouseOnNavigator = false;
      });
    };

    if (!navReady) {
      navReady = true;
    }

    return () => {
      paper.project.remove();
      drawNav.current = null;
    };
  }, [clock.applicationTime, evas.selectedEVA, videos.videos]);

  useInterval(() => {
    if (!navReady) {
      // nothing to update if the paperjs timeline hasn't been instantiated
      return;
    }

    const { clock } = store.getState();
    const newMissionTime = getMissionTime(clock);
    if (mouseOnNavigator) {
      // the user is mousing, don't update the nav out from under them
      // but update the mission time indicator
      drawNav.current.drawCursor(newMissionTime);
    } else {
      if (newMissionTime !== missionTime) {
        drawNav.current.drawTier1NavBox(newMissionTime);
        drawNav.current.drawTier2();
        drawNav.current.drawCursor(newMissionTime);
        missionTime = newMissionTime;
      }
    }
  }, 50);

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
