import isEmpty from "lodash/isEmpty";
import isNull from "lodash/isNull";
import paper from "paper";
import { appSecondsFromDateString, hhmmssFromSeconds } from "utils/formatting";

export default class DrawNav {
  gTier1Group: paper.Group;
  gTier1FutureGroup: paper.Group;
  gTier1NavGroup: paper.Group;
  gTier1NavBoxLocX: number;

  gTier2Group: paper.Group;
  gTier2BoarderGroup: paper.Group;
  gTier2StartSeconds: number;

  gCursorGroup: paper.Group;
  gNavCursorGroup: paper.Group;

  gNavigatorWidth: number;
  gNavigatorHeight: number;

  gNavZoomFactor = 50;
  gTier1Height: number;
  gTier2Height: number;
  gTier1PixelsPerSecond: number;
  gTier1SecondsPerPixel: number;
  gTier2PixelsPerSecond: number;
  gTier2SecondsPerPixel: number;
  gTierSpacing: number;
  gTier1Top: number;
  gTier2Top: number;
  gTier1Left: number;
  gTier2Left: number;

  cSecondsIn24Hours = 86400;

  constructor(
    readonly videoFiles: VideoFile[],
    readonly photoFiles: PhotoFile[],
    readonly collectionFilters: PhotoCollectionFilters[],
    readonly dayNight: DayNightObj[],
    readonly asPerformed: {
      [x: string]: Activity[];
    },
    /** Keep track of dates for bookkeeping purposes */
    readonly dateRendered: Date,
    /** Keep track of which EVA was rendered for bookkeping purposes */
    readonly evaRendered: string,
    readonly evaStartSec: number,
    readonly isToday: boolean
  ) {}

  initGroups() {
    if (typeof this.gTier1Group !== "undefined") {
      this.gTier1Group.removeChildren();
      this.gTier1FutureGroup.removeChildren();
      this.gTier1NavGroup.removeChildren();
      this.gTier2Group.removeChildren();
      this.gCursorGroup.removeChildren();
      this.gNavCursorGroup.removeChildren();
    } else {
      this.gTier1Group = new paper.Group();
      this.gTier1FutureGroup = new paper.Group();
      this.gTier1NavGroup = new paper.Group();
      this.gTier2Group = new paper.Group();
      this.gTier2BoarderGroup = new paper.Group();
      this.gCursorGroup = new paper.Group();
      this.gNavCursorGroup = new paper.Group();
    }
  }

  handleMouseMove = (event, missionTimeSeconds, cb) => {
    let mouseXSeconds;
    this.gCursorGroup.removeChildren();
    this.gNavCursorGroup.removeChildren();
    // if (event.point.y > this.gTier1Top) {
    //   //if in tier1
    //   mouseXSeconds = event.point.x * this.gTier1SecondsPerPixel;
    //   this.drawTier1NavBox(mouseXSeconds);
    //   this.drawTier2();
    // } else {
    //   //if in tier 2
    //   mouseXSeconds =
    //     (event.point.x - this.gTier2Left) * this.gTier2SecondsPerPixel + this.gTier2StartSeconds;
    // }
    // this.drawCursor(missionTimeSeconds);
    // this.drawNavCursor(mouseXSeconds);
    cb(mouseXSeconds);
  };

  handleMouseUp = (event, cb: (hh: number, mm: number, ss: number) => void) => {
    let seconds = 0;
    // if (event.point.y > this.gTier1Top) {
    //   seconds = Math.round(event.point.x * this.gTier1SecondsPerPixel);
    // } else {
    //   //if in tier 2
    //   seconds = Math.round(
    //     (event.point.x - this.gTier2Left) * this.gTier2SecondsPerPixel + this.gTier2StartSeconds
    //   );
    // }

    const hh = Math.floor(seconds / 3600);
    const mm = Math.floor((seconds - hh * 3600) / 60);
    const ss = seconds - hh * 3600 - mm * 60;

    // this.drawCursor(seconds);
    cb(hh, mm, ss);
  };

  handleMouseLeave = (_event, cb) => {
    cb();
    this.gNavCursorGroup.removeChildren();
  };

  setDynamicWidthVariables = () => {
    this.gNavigatorWidth = paper.view.size.width;
    this.gNavigatorHeight = paper.view.size.height;

    this.gTier1PixelsPerSecond = this.gNavigatorWidth / this.cSecondsIn24Hours;
    this.gTier1SecondsPerPixel = this.cSecondsIn24Hours / this.gNavigatorWidth;
    this.gTier2PixelsPerSecond =
      this.gNavigatorWidth / (this.cSecondsIn24Hours / this.gNavZoomFactor);
    this.gTier2SecondsPerPixel =
      this.cSecondsIn24Hours / this.gNavZoomFactor / this.gNavigatorWidth;

    this.gTier1Height = 50;
    this.gTier2Height = 99;

    this.gTierSpacing = 30;

    this.gTier2Top = 30;
    this.gTier1Top = this.gTier2Top + this.gTier2Height + this.gTierSpacing;

    this.gTier1Left = 1;
    this.gTier2Left = 1;
  };

  drawTimeTicks(secondsStart, secondsEnd, pixelsePerSecond, topPoint, tickHeight) {
    // display time ticks
    for (let i = 0; i < this.cSecondsIn24Hours; i++) {
      // sillily complex thing to show time ticks on the hour
      if (
        parseInt(hhmmssFromSeconds(i).substring(3, 5)) % (10 * 60) === 0 &&
        hhmmssFromSeconds(i).substring(6, 8) === "00"
      ) {
        let itemLocX = i * this.gTier1PixelsPerSecond;
        let topPoint = new paper.Point(itemLocX, this.gTier1Top);
        let bottomPoint = new paper.Point(itemLocX, this.gTier1Top + 10);
        let aLine = new paper.Path.Line(topPoint, bottomPoint);
        aLine.strokeColor = new paper.Color("#7b7b7b");

        this.gTier1Group.addChild(aLine);
      }
    }
  }

  drawTier1() {
    this.gTier1Group.removeChildren();
  }
}
