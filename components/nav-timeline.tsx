import get from "lodash/get";
import deepEqual from "lodash/isEqual";
import isNull from "lodash/isNull";
import paper from "paper";
import { MutableRefObject, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { PlayheadState, isSameDate, changeTime } from "store/playhead";
import {
  evaSelector,
  EVAsState,
  getActivityPerformanceMissionTime,
  getEVAStartMilliseconds,
} from "store/evas";
import { selectVideoFiles, selectVideoTimingData, VideosState } from "store/videos";
import { selectPhotoFiles, PhotosState, setActivePhoto } from "store/photos";
import DrawNav from "./nav-timeline-draw";
import { secondsIntoDayFromZuluDateString } from "utils/formatting";
import { RootState } from "store/index";

/**
 * Renders the navigation timeline presented at the top of the CODA window
 */
function NavTimeline() {
  const {
    playhead,
    evas,
    videos,
    photos,
  }: {
    playhead: PlayheadState;
    evas: EVAsState;
    videos: VideosState;
    photos: PhotosState;
  } = useSelector((state: RootState) => state, deepEqual);
  const dispatch = useDispatch();
  const timingData = selectVideoTimingData(videos);
  const videoFiles = selectVideoFiles(videos);
  const photoFiles = selectPhotoFiles(photos);

  const eva = evaSelector(evas);
  const canvas = useRef();
  const time: MutableRefObject<number> = useRef(0);
  const drawNav: MutableRefObject<DrawNav> = useRef(null);
  const mouseOnNavigator: MutableRefObject<boolean> = useRef(false);
  const navReady: MutableRefObject<boolean> = useRef(false);

  let evaStartSec = null as number;
  const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d))$/; // matches valid hh:mm times
  if (!isNull(eva) && !isNull(eva.startTime.match(reHHMM))) {
    const [hh, mm] = eva.startTime.split(":");
    evaStartSec = 3600 * +hh + 60 * +mm;
  }

  const installTimeline = () => {
    // only setup the canvas once
    if (isNull(paper.project)) {
      paper.setup(canvas.current);
    }

    const paperRendered = !isNull(paper.project) && !paper.project.isEmpty();
    const sameVideos =
      !isNull(drawNav.current) && drawNav.current.hasAlreadyRenderedVideos(videoFiles);
    const sameDate =
      !isNull(drawNav.current) && isSameDate(drawNav.current.dateRendered, new Date(playhead.date));
    const sameEVA = !isNull(drawNav.current) && evas.selectedEVA === drawNav.current.evaRendered;

    if (paperRendered && sameVideos && sameDate && sameEVA) {
      // bail if there's no reason to rerender the timeline
      return;
    }

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

    const isToday = isSameDate(new Date(), new Date(playhead.date));

    drawNav.current = new DrawNav(
      timingData,
      videoFiles,
      photoFiles,
      dayNight,
      activityPerformance,
      new Date(playhead.date),
      evas.selectedEVA,
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
      drawNav.current.handleMouseMove(event, time.current, () => {
        if (!mouseOnNavigator.current) {
          mouseOnNavigator.current = true;
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
    paper.project.remove(); // always kill previous timeline
    installTimeline();
  }, [eva, videos.videos, photos.photos]);

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
