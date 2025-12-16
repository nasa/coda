import get from "lodash/get";
import isNil from "lodash/isNil";
import paper from "paper";
import { MutableRefObject, useEffect, useRef, useState, FunctionComponent } from "react";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import {
  getAsPerformedMissionTime,
  getSequenceStartMilliseconds,
  idFromDate,
} from "store/sequences";
import { filterVisibleVideos } from "store/videos";
import { setAppSeconds, setHoverSeconds } from "store/clock";

import DrawNav from "./nav-timeline-draw";
import styles from "./nav-timeline-draw.module.css";
import ClockInterval from "components/framework/ClockInterval";

/**
 * Renders the navigation timeline presented at the bottom of the CODA window
 */
const NavTimeline: FunctionComponent<{ source: Source }> = ({ source }) => {
  const dispatch = useAppDispatch();
  const dayNights: DayNightState = useAppSelector((state) => state.dayNight, deepEqual);
  const videos: VideosState = useAppSelector((state) => state.videos, deepEqual);
  const photos: PhotosState = useAppSelector((state) => state.photos, deepEqual);
  const sequences: SequencesState = useAppSelector((state) => state.sequences, deepEqual);
  const audioFiles: TbAudioFile[] = useAppSelector((state) => state.talkybot.audioFiles, deepEqual);
  const playheadDate = useAppSelector((state) => state.clock.date, refEqual);
  const hoverSeconds = useAppSelector((state) => state.clock.hoverSeconds, refEqual);
  const [appSeconds, setLocalAppSeconds] = useState(0);

  const dayNight = dayNights.dayNight;

  let allEVAs = sequences.allSequences;
  if (source === "NBL") {
    // Show only NBL sequences
    allEVAs = allEVAs.filter((eva) => eva.displayTitle.includes("NBL"));
  } else if (source === "TEST_EVENTS") {
    // Filter out all NBL sequences
    allEVAs = allEVAs.filter((eva) => !eva.displayTitle.includes("NBL"));
  }

  const sequence = allEVAs.find((eva) => eva.startDate === idFromDate(playheadDate));
  const time: MutableRefObject<number> = useRef(0);
  const drawNav: MutableRefObject<DrawNav> = useRef(null);
  const canvas: MutableRefObject<HTMLCanvasElement> = useRef(null);
  const canvasContainer: MutableRefObject<HTMLDivElement> = useRef(null);
  const mouseOnNavigator: MutableRefObject<boolean> = useRef(false);
  const navReady: MutableRefObject<boolean> = useRef(false);

  let evaStartSec = null as number;
  const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d))$/; // matches valid hh:mm times
  if (!isNil(sequence) && !isNil(sequence.startTime.match(reHHMM))) {
    const [hh, mm] = sequence.startTime.split(":");
    evaStartSec = 3600 * +hh + 60 * +mm;
  }

  /** Draw the timeline on the canvas from scratch */
  const installTimeline = () => {
    if (isNil(paper.project) && typeof window !== "undefined") {
      paper.setup(canvas.current);
    }

    const asPerformed = { EV1: [], EV2: [] } as { EV1: Activity[]; EV2: Activity[] };
    if (!isNil(sequence)) {
      const activityStartUTCMilliseconds = getSequenceStartMilliseconds(sequence);
      const EV1 = get(sequence.asPerformed, "EV1", null);
      if (!isNil(EV1)) {
        asPerformed.EV1 = getAsPerformedMissionTime(
          EV1,
          sequence.startDate,
          activityStartUTCMilliseconds
        );
      }
      const EV2 = get(sequence.asPerformed, "EV2", null);
      if (!isNil(EV2)) {
        asPerformed.EV2 = getAsPerformedMissionTime(
          EV2,
          sequence.startDate,
          activityStartUTCMilliseconds
        );
      }
    }

    const playheadDateObj = new Date(playheadDate);

    drawNav.current = new DrawNav({
      videoFiles: filterVisibleVideos(videos.videoFiles, playheadDateObj),
      mtxPlaybackAvailability: videos.mtxPlaybackAvailability,
      mtxHlsEndpoints: videos.mtxHlsEndpoints,
      source,
      photoFiles: photos.photoFiles,
      collectionFilters: photos.collectionFilters,
      dayNight: dayNight,
      asPerformed: asPerformed,
      dateRendered: playheadDateObj,
      evaStartSec: evaStartSec,
      audioFiles: audioFiles,
    });

    drawNav.current.initGroups();
    drawNav.current.setDynamicWidthVariables();
    drawNav.current.drawTier1();
    drawNav.current.drawNavBox(time.current);
    drawNav.current.drawTier2();
    drawNav.current.drawCursor(time.current);

    paper.view.onResize = function () {
      drawNav.current.setDynamicWidthVariables();
      drawNav.current.drawTier1();
      drawNav.current.drawNavBox(time.current);
      drawNav.current.drawTier2();
    };

    const mouseMoveCb = (thisHoverSeconds: number) => {
      if (!mouseOnNavigator.current) {
        mouseOnNavigator.current = true;
        // Make the canvas receive click events
        canvasContainer.current.style.pointerEvents = "auto";
      }
      if (hoverSeconds !== thisHoverSeconds) {
        dispatch(setHoverSeconds(thisHoverSeconds));
      }
    };
    const mouseUpCb = (hh: number, mm: number, ss: number) => {
      const secondsIntoDate = ss + 60 * mm + 3600 * hh;
      dispatch(setAppSeconds(secondsIntoDate));
    };
    const mouseLeaveCb = () => {
      mouseOnNavigator.current = false;
      drawNav.current.drawNavBox(time.current);
      drawNav.current.drawTier2();
      drawNav.current.drawCursor(time.current);

      // put null in hoverSeconds to disable them across components
      dispatch(setHoverSeconds(null));

      // Make the canvas ignore click events (but still receive mousemove events--somehow).
      // Hover events still work for Paper reason which is super handy for us)
      canvasContainer.current.style.pointerEvents = "none";
    };

    paper.view.onMouseMove = (event: paper.MouseEvent) => {
      drawNav.current.handleMouseMove(event, time.current, mouseMoveCb, mouseLeaveCb);
    };
    paper.view.onMouseUp = (event: paper.MouseEvent) => {
      drawNav.current.handleMouseUp(event, mouseUpCb);
    };
    paper.view.onMouseLeave = (event: paper.MouseEvent) => {
      drawNav.current.handleMouseLeave(event, mouseLeaveCb);
    };

    if (!navReady.current) {
      navReady.current = true;
    }
  };

  useEffect(() => {
    if (paper.project) {
      paper.project.remove();
    }
    installTimeline();
  }, [sequence, videos, photos.photoFiles, dayNight, photos, playheadDate, audioFiles]);

  useEffect(() => {
    time.current = appSeconds;

    if (!navReady.current) {
      // nothing to update if the paperjs timeline hasn't been instantiated
      return;
    }

    if (!mouseOnNavigator.current) {
      drawNav.current.drawTier1();
      drawNav.current.drawNavBox(time.current);
    }
    drawNav.current.drawTier2();
    drawNav.current.drawCursor(time.current);
  }, [appSeconds]);

  return (
    <>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      <div className={styles.expandedBackground}></div>
      <div ref={canvasContainer} className={styles.canvasContainer}>
        <canvas ref={canvas} data-paper-resize />
      </div>
    </>
  );
};

export default NavTimeline;
