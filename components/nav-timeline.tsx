import get from "lodash/get";
import isNull from "lodash/isNull";
import paper from "paper";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ClockState, getApplicationUTC, getMissionTime, set } from "store/clock";
import {
  evaSelector,
  EVAsState,
  getActivityPerformanceMissionTime,
  getEVAStartMilliseconds,
  selectEVAStartMilliseconds,
} from "store/evas";
import { selectVideoFiles, selectVideoTimingData, VideosState } from "store/videos";
import useInterval from "utils/useInterval";
import DrawNav from "./draw-nav";

// these vars only affect the canvas so avoid updating the React component state
let missionTime = null;
let mouseOnNavigator = false;
let navReady = false;
let drawNav = null as DrawNav;

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

  useEffect(() => {
    // only setup the canvas once
    if (isNull(paper.project)) {
      paper.setup(canvas.current);
    }

    const paperRendered = !isNull(paper.project) && !paper.project.isEmpty();
    const sameVideos = !isNull(drawNav) && drawNav.hasAlreadyRenderedVideos(videoFiles);
    const sameDate = !isNull(drawNav) && drawNav.dateRendered === new Date(clock.applicationTime);

    if (paperRendered && sameVideos && sameDate) {
      // bail if there's no reason to rerender the timeline
      return;
    } else {
      // clear out the timeline before rerendering
      paper.project.clear();
    }

    const dayNight = eva?.dayNight || null;
    // TODO: calculate activity performance here instead of duing getStaticProps
    // TODO: need to blow away the nav-timeline when:
    //   - the UTC date changes
    //   - new video data for this UTC day has arrived
    // maybe put a property on the drawDraw that indicates date, whether it used activity performance, etc? then check that first in useEffect to see if the updated store would cause the nav-timeline to change

    const activityStartUTCMilliseconds = getEVAStartMilliseconds(eva);
    const activityPerformance = { EV1: [], EV2: [] };
    if (!isNull(eva)) {
      const EV1 = get(eva, ["execution", "EV1"], null);
      if (!isNull(EV1)) {
        activityPerformance.EV1 = getActivityPerformanceMissionTime(
          eva.execution.EV1,
          timingData,
          activityStartUTCMilliseconds
        );
      }
      const EV2 = get(eva, ["execution", "EV2"], null);
      if (!isNull(EV2)) {
        activityPerformance.EV2 = getActivityPerformanceMissionTime(
          eva.execution.EV2,
          timingData,
          activityStartUTCMilliseconds
        );
      }
    }

    drawNav = new DrawNav(
      timingData,
      videoFiles,
      dayNight,
      activityPerformance,
      new Date(clock.applicationTime)
    );

    drawNav.initGroups();
    drawNav.setDynamicWidthVariables();
    drawNav.drawTier1();
    drawNav.drawTier1NavBox(missionTime);
    drawNav.drawTier2();

    paper.view.onResize = function () {
      drawNav.setDynamicWidthVariables();
      drawNav.drawTier1();
      drawNav.drawTier1NavBox(missionTime);
      drawNav.drawTier2();
      drawNav.drawCursor(missionTime);
    };

    paper.view.onMouseMove = (event) => {
      drawNav.handleMouseMove(event, () => {
        if (!mouseOnNavigator) {
          mouseOnNavigator = true;
        }
      });
    };
    paper.view.onMouseUp = (event) => {
      drawNav.handleMouseUp(event, (hh: number, mm: number, ss: number) => {
        const utc = getApplicationUTC(clock);
        const Y = utc.getUTCFullYear();
        const M = utc.getUTCMonth();
        const D = utc.getUTCDate();
        // time is in Zulu time. we need to convert to UTC
        const dt = new Date(Date.UTC(Y, M - 1, D, hh, mm, ss));
        dispatch(set(dt.toISOString()));
      });
    };
    paper.view.onMouseLeave = (event) => {
      drawNav.handleMouseLeave(event, () => {
        mouseOnNavigator = false;
      });
    };

    if (!navReady) {
      navReady = true;
    }

    return () => paper.project.clear();
  }, [clock.applicationTime, videos.videos]);

  useInterval(() => {
    if (!navReady) {
      // nothing to update if the paperjs timeline hasn't been instantiated
      return;
    }

    if (mouseOnNavigator) {
      // the user is mousing, don't update the nav out from under them
      return;
    }

    const { clock } = store.getState();
    const newMissionTime = getMissionTime(clock);
    if (newMissionTime !== missionTime) {
      drawNav.drawTier1NavBox(newMissionTime);
      drawNav.drawTier2();
      drawNav.drawCursor(newMissionTime);
      missionTime = newMissionTime;
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
