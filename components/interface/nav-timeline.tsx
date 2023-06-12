import get from "lodash/get";
import isNil from "lodash/isNil";
import paper from "paper";
import { MutableRefObject, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { changeTime, isSameDate } from "store/playhead";
import { changeHoverTime } from "store/playheadHover";
import {
  getAsPerformedMissionTime,
  getSequenceStartMilliseconds,
  idFromDate,
} from "store/sequences";
import { filterVisibleVideos } from "store/videos";

import DrawNav from "./nav-timeline-draw";
import { RootState } from "store/index";
import { Collection } from "utils/enums";
import styles from "./nav-timeline-draw.module.css";

/**
 * Renders the navigation timeline presented at the bottom of the CODA window
 */
export default function NavTimeline(props: { collection: Collection }) {
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const playheadHover: PlayheadHoverState = useSelector((state: RootState) => state.playheadHover);
  const dayNights: DayNightState = useSelector((state: RootState) => state.dayNight);
  const videos: VideosState = useSelector((state: RootState) => state.videos);
  const photos: PhotosState = useSelector((state: RootState) => state.photos);
  const sequences: SequencesState = useSelector((state: RootState) => state.sequences);
  const sgAudioActivityRanges: SgActivityRangeRecord[][] = useSelector(
    (state: RootState) => state.sgAudio.sgActivityRanges
  );
  const maestro: MaestroState = useSelector((state: RootState) => state.maestro);

  const dispatch = useDispatch();
  const dayNight = dayNights.dayNight;

  const videoFiles = videos.videoFiles;
  const photoFiles = photos.photoFiles;

  let allEVAs = sequences.allSequences;
  if (props.collection === Collection.NBL) {
    // Show only NBL sequences
    allEVAs = allEVAs.filter((eva) => eva.displayTitle.includes("NBL"));
  } else if (props.collection === Collection.TEST_EVENTS) {
    // Filter out all NBL sequences
    allEVAs = allEVAs.filter((eva) => !eva.displayTitle.includes("NBL"));
  }

  const maestroDataAvailable = !isNil(maestro.processedActivitiesData);
  const sequence = allEVAs.find((eva) => eva.startDate === idFromDate(playhead.date));
  const evaName = !maestroDataAvailable ? get(sequence, "name", "") : maestro.title;
  const time: MutableRefObject<number> = useRef(0);
  const drawNav: MutableRefObject<DrawNav> = useRef(null);
  const canvas: MutableRefObject<HTMLCanvasElement> = useRef(null);
  const canvasContainer: MutableRefObject<HTMLDivElement> = useRef(null);
  const mouseOnNavigator: MutableRefObject<boolean> = useRef(false);
  const navReady: MutableRefObject<boolean> = useRef(false);

  let evaStartSec = null as number;
  if (!maestroDataAvailable) {
    const reHHMM = /^(?:(?:([01]?\d|2[0-3]):[0-5]\d))$/; // matches valid hh:mm times
    if (!isNil(sequence) && !isNil(sequence.startTime.match(reHHMM))) {
      const [hh, mm] = sequence.startTime.split(":");
      evaStartSec = 3600 * +hh + 60 * +mm;
    }
  } else {
    evaStartSec = maestro.evaStartSec;
  }

  /** Draw the timeline on the canvas from scratch */
  const installTimeline = () => {
    if (isNil(paper.project) && typeof window !== "undefined") {
      paper.setup(canvas.current);
    }

    const asPerformed = { EV1: [], EV2: [] } as { EV1: Activity[]; EV2: Activity[] };
    if (!maestroDataAvailable) {
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
    } else {
      asPerformed.EV1 = maestro.processedActivitiesData.EV1;
      asPerformed.EV2 = maestro.processedActivitiesData.EV2;
    }

    const playheadDate = new Date(playhead.date);
    const isToday = isSameDate(new Date(), playheadDate);

    drawNav.current = new DrawNav(
      filterVisibleVideos(videoFiles, playheadDate),
      photoFiles,
      photos.collectionFilters,
      dayNight,
      asPerformed,
      playheadDate,
      evaName,
      evaStartSec,
      isToday,
      sgAudioActivityRanges
    );

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

    const mouseMoveCb = (thisHoverSeconds) => {
      if (!mouseOnNavigator.current) {
        mouseOnNavigator.current = true;
        // Make the canvas receive click events
        canvasContainer.current.style.pointerEvents = "auto";
      }
      if (playheadHover.seconds !== thisHoverSeconds) {
        dispatch(changeHoverTime(thisHoverSeconds));
      }
    };
    const mouseUpCb = (hh: number, mm: number, ss: number) => {
      const secondsIntoDate = ss + 60 * mm + 3600 * hh;
      dispatch(changeTime(secondsIntoDate));
    };
    const mouseLeaveCb = () => {
      mouseOnNavigator.current = false;
      drawNav.current.drawNavBox(time.current);
      drawNav.current.drawTier2();
      drawNav.current.drawCursor(time.current);
      dispatch(changeHoverTime(0));
      // Make the canvas ignore click events (but still receive mousemove events--somehow).
      // Hover events still work for Paper reason which is super handy for us)
      canvasContainer.current.style.pointerEvents = "none";
    };

    paper.view.onMouseMove = (event) => {
      drawNav.current.handleMouseMove(event, time.current, mouseMoveCb, mouseLeaveCb);
    };
    paper.view.onMouseUp = (event) => {
      drawNav.current.handleMouseUp(event, mouseUpCb);
    };
    paper.view.onMouseLeave = (event) => {
      drawNav.current?.handleMouseLeave(event, mouseLeaveCb);
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
  }, [sequence, maestroDataAvailable, videoFiles, photoFiles, dayNight, photos, playhead.date]);

  useEffect(() => {
    time.current = playhead.seconds;

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
  }, [playhead.seconds]);

  return (
    <>
      {/* {!mouseOnNavigator.current && <div className={styles.collapsedBackground}></div>}
      {mouseOnNavigator.current && <div className={styles.expandedBackground}></div>} */}
      <div className={styles.expandedBackground}></div>
      <div ref={canvasContainer} className={styles.canvasContainer}>
        <canvas ref={canvas} data-paper-resize />
      </div>
    </>
  );
}
