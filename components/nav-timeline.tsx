import { useRouter } from "next/router";
import paper from "paper";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ClockState, getMissionTime, set } from "store/clock";
import { evaSelector, EVAsState, selectEVAStartMilliseconds } from "store/evas";
import { selectVideoFiles, selectVideoTimingData, VideosState } from "store/videos";
import useInterval from "utils/useInterval";
import DrawNav from "./draw-nav";

// these vars only affect the canvas so avoid updating the React component state
let missionTime = null;
let mouseOnNavigator = false;
let paperReady = false;
let drawNav: DrawNav;

/**
 * Renders the navigation timeline presented at the top of the CODA window
 */
function NavTimeline() {
  const {
    query: { utc = null, pet = null },
  }: {
    query: {
      utc?: number;
      pet?: number;
    };
  } = useRouter();
  const store = useStore();
  const {
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
  const { activityPerformance, dayNight, startDate } = evaSelector(evas);

  const canvas = useRef();

  useEffect(() => {
    // bail if we've already instantiated the paperjs timeline
    if (drawNav) {
      return;
    }

    drawNav = new DrawNav(timingData, videoFiles, dayNight, activityPerformance);

    paper.setup(canvas.current);
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
        const [Y, M, D] = startDate.split("/");
        // time is in Zulu time. we need to convert to UTC
        const dt = new Date(Date.UTC(+Y, +M - 1, +D, hh, mm, ss));
        dispatch(set(dt.toISOString()));
      });
    };
    paper.view.onMouseLeave = (event) => {
      drawNav.handleMouseLeave(event, () => {
        mouseOnNavigator = false;
      });
    };

    if (!paperReady) {
      paperReady = true;
    }
  }, []);

  useInterval(() => {
    if (!paperReady) {
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
