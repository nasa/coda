import isEmpty from "lodash/isEmpty";
import isNull from "lodash/isNull";
import paper from "paper";
import { VideoFile, PhotoFile } from "services/io";
import { Activity, DayNight } from "services/iss-wiki";
import { TimingData } from "store/videos";
import {
  secondsToTimeStr,
  secondsToZuluString,
  secondsIntoDayFromZuluDateString,
  zuluDateToMissionSeconds,
} from "utils/formatting";

export default class DrawNav {
  gTier1Group: paper.Group;
  gTier1NavGroup: paper.Group;
  gTier1NavBoxLocX: number;

  gTier2Group: paper.Group;
  gTier2BoarderGroup: paper.Group;
  gTier2StartSeconds: number;

  gCursorGroup: paper.Group;
  gNavCursorGroup: paper.Group;

  gNavigatorWidth: number;
  gNavigatorHeight: number;

  gNavZoomFactor = 25;
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

  gColorCursor = new paper.Color("#ff0000");
  gColorNavCursor = new paper.Color("#19181b");
  gColorTimeTicks = new paper.Color("#7b7b7b");
  gColorVideo = new paper.Color("#999999");
  gColorVideoLOS = new paper.Color("#4e4e4e");
  gColorVideoBorder = "#2a282e";
  tierBoxColor = new paper.Color("#999999");
  gColorZoomPane1Border = new paper.Color("#5E92A6");
  gColorZoomPane2Border = new paper.Color("#84b8d9");
  gActivityBackgroundColor = new paper.Color("#eb272b");
  gAlphaRectOpacity = 0.4;
  gNaxBoxZoomFadeOpacity = 0.2;

  gNavigatorFontFamily = "Ubuntu Mono";
  gNavigatorFontFamilyActivity = "Inter";
  //  gNavigatorFontFamily = "Inter";
  //  gNavigatorFontFamily = "Space Mono";

  cChannelStrokeWidth = 4;
  cVidBarGapWidth = 1;

  constructor(
    readonly timingData: TimingData,
    readonly videoFiles: VideoFile[],
    readonly photoFiles: PhotoFile[],
    readonly dayNight: DayNight,
    readonly activityPerformance: {
      [x: string]: Activity[];
    },
    /** Keep track of dates for bookkeeping purposes */
    readonly dateRendered: Date,
    /** Keep track of which EVA was rendered for bookkeping purposes */
    readonly evaRendered: string,
    readonly isToday: boolean
  ) {}

  initGroups() {
    if (typeof this.gTier1Group !== "undefined") {
      this.gTier1Group.removeChildren();
      this.gTier1NavGroup.removeChildren();
      this.gTier2Group.removeChildren();
      this.gCursorGroup.removeChildren();
      this.gNavCursorGroup.removeChildren();
    } else {
      this.gTier1Group = new paper.Group();
      this.gTier1NavGroup = new paper.Group();
      this.gTier2Group = new paper.Group();
      this.gTier2BoarderGroup = new paper.Group();
      this.gCursorGroup = new paper.Group();
      this.gNavCursorGroup = new paper.Group();
    }
  }

  drawTier1() {
    this.gTier1Group.removeChildren();
    let tierRect = new paper.Rectangle(
      this.gTier1Left,
      this.gTier1Top,
      this.gNavigatorWidth,
      this.gTier1Height
    );
    const cornerSize = new paper.Size(5, 5);
    // let tierRectPath = new paper.Path.Rectangle(tierRect, cornerSize);
    // tierRectPath.strokeColor = tierBoxColor;
    // gTier1Group.addChild(tierRectPath);

    // display time ticks
    for (let i = 0; i < this.timingData["EVA_duration_seconds"]; i++) {
      // sillily complex thing to show time ticks on the hour
      if (
        parseInt(secondsToTimeStr(i).substring(3, 5)) % (10 * 60) === 0 &&
        secondsToTimeStr(i).substring(6, 8) === "00"
      ) {
        let itemLocX = i * this.gTier1PixelsPerSecond;
        let topPoint = new paper.Point(itemLocX, this.gTier1Top);
        let bottomPoint = new paper.Point(itemLocX, this.gTier1Top + 10);
        let aLine = new paper.Path.Line(topPoint, bottomPoint);
        aLine.strokeColor = this.gColorTimeTicks;

        this.gTier1Group.addChild(aLine);
      }
    }

    // display video segments
    for (let i = 0; i < this.videoFiles.length; i++) {
      let startLocX = this.videoFiles[i].missionSecondsStart * this.gTier1PixelsPerSecond;
      let endLocX = this.videoFiles[i].missionSecondsEnd * this.gTier1PixelsPerSecond;

      let startLocY =
        this.gTier1Top +
        1 +
        this.videoFiles[i]["group"] * (this.cChannelStrokeWidth + this.cVidBarGapWidth);
      let endLocY = startLocY + this.cChannelStrokeWidth + 1;

      const name = "vidItem_" + i.toString();

      let vidLine = new paper.Path.Rectangle({
        from: [startLocX, startLocY],
        to: [endLocX, endLocY],
        strokeWidth: 0.5,
        strokeColor: this.gColorVideoBorder,
        fillColor: this.gColorVideo,
        name,
      });
      if (this.videoFiles[i].className === "downlink-LOS") vidLine.fillColor = this.gColorVideoLOS;
      this.gTier1Group.addChild(vidLine);
    }

    // display EV activity
    if (!isEmpty(this.activityPerformance)) {
      this.drawTier1EVActivity(7, this.activityPerformance.EV1); // row 8 for EV1 (rows start at 0)
      this.drawTier1EVActivity(8, this.activityPerformance.EV2); // row 9 for EV2 (rows start at 0)
    }
    if (!isNull(this.dayNight) && !isEmpty(this.dayNight.events)) {
      this.drawTier1EVActivity(9, this.dayNight.events); // row 10 for day night  //TODO: pending access to this data for all EVAs. Wiki currently uncooperative.
    }

    // if isToday, indicate the "future" (https://www.youtube.com/watch?v=VVle0kopfes)
    if (this.isToday) {
      const secondsIntoToday = zuluDateToMissionSeconds(new Date(), this.timingData);

      let futureLocX = 0.5 + secondsIntoToday * this.gTier1PixelsPerSecond;
      const futureLocY = this.gTier1Top + 15;
      const futureLeftPoint = new paper.Point(futureLocX, futureLocY);
      const futureRightPoint = new paper.Point(this.gNavigatorWidth, futureLocY);
      const fLine = new paper.Path.Line(futureLeftPoint, futureRightPoint);
      fLine.strokeColor = new paper.Color(50, 50, 50, 0.1);
      fLine.strokeWidth = 90;
      fLine.dashArray = [2, 2];
      this.gTier1Group.addChild(fLine);
    }

    // display photo ticks
    for (let i = 0; i < this.photoFiles.length; i++) {
      const photoTimeSeconds = secondsIntoDayFromZuluDateString(this.photoFiles[i].date_taken);

      let itemLocX = photoTimeSeconds * this.gTier1PixelsPerSecond;

      let topPoint = new paper.Point(itemLocX, this.gTier1Top + this.gTier1Height - 10);
      let bottomPoint = new paper.Point(itemLocX, this.gTier1Top + this.gTier1Height - 5);
      let aLine = new paper.Path.Line(topPoint, bottomPoint);
      aLine.strokeColor = new paper.Color("green");

      this.gTier1Group.addChild(aLine);
    }
  }

  drawTier1EVActivity(rowNum, evActivityArray: Activity[]) {
    for (let i = 0; i < evActivityArray.length; i++) {
      let startLocX = evActivityArray[i].startTimeSeconds * this.gTier1PixelsPerSecond;
      let endLocX = evActivityArray[i].endTimeSeconds * this.gTier1PixelsPerSecond;
      let startLocY =
        this.gTier1Top + 1 + rowNum * (this.cChannelStrokeWidth + this.cVidBarGapWidth);
      let endLocY = startLocY + this.cChannelStrokeWidth + 1;
      let activityLine = new paper.Path.Rectangle({
        from: [startLocX, startLocY],
        to: [endLocX, endLocY],
        strokeWidth: 0.5,
        strokeColor: "black",
        // fillColor: gActivityBackgroundColor,
        fillColor: evActivityArray[i].color,
        // name: name,
      });
      this.gTier1Group.addChild(activityLine);
    }
  }

  drawTier1NavBox = (seconds) => {
    this.gTier1NavGroup.removeChildren();

    let locX = seconds * this.gTier1PixelsPerSecond;
    let navBoxWidth = this.gNavigatorWidth / this.gNavZoomFactor;
    this.gTier1NavBoxLocX = locX - navBoxWidth / 2;
    if (this.gTier1NavBoxLocX < 0) {
      this.gTier1NavBoxLocX = 0;
    } else if (this.gTier1NavBoxLocX + navBoxWidth > this.gNavigatorWidth) {
      this.gTier1NavBoxLocX = this.gNavigatorWidth - navBoxWidth;
    }
    this.gTier2StartSeconds = this.gTier1SecondsPerPixel * this.gTier1NavBoxLocX;

    const navBoxTop = this.gTier1Top - 3;
    const navBoxHeight = this.gTier1Height + 2;
    let navBoxRect = new paper.Rectangle(
      this.gTier1NavBoxLocX,
      navBoxTop,
      navBoxWidth,
      navBoxHeight
    );
    const cornerSize = new paper.Size(2, 2);
    let navBoxRectPath = new paper.Path.Rectangle(navBoxRect, cornerSize);
    //var navBoxRectPath = paper.Path.Rectangle(navBoxRect);
    navBoxRectPath.strokeColor = new paper.Color("#ffc000");
    navBoxRectPath.strokeWidth = 4;
    this.gTier1NavGroup.addChild(navBoxRectPath);

    //navBoxEffect
    const startPoint = new paper.Point(this.gTier1NavBoxLocX - 2, navBoxTop + 3);
    const boxWidth = navBoxWidth + 4;
    const effectHeight = this.gTierSpacing + 1;
    const effectSideWidth = 30;
    let navBoxEffect = new paper.Path({
      strokeColor: "black",
      closed: true,
      fillColor: "#ffc000",
      strokeWidth: 0,
    });
    navBoxEffect.moveTo(startPoint);
    navBoxEffect.arcTo(
      new paper.Point(
        startPoint.x - effectSideWidth / 2,
        startPoint.y - effectHeight + effectSideWidth / 6
      ),
      new paper.Point(startPoint.x - effectSideWidth, startPoint.y - effectHeight)
    );
    navBoxEffect.lineTo(
      new paper.Point(startPoint.x + effectSideWidth + boxWidth, startPoint.y - effectHeight)
    );
    navBoxEffect.arcTo(
      new paper.Point(
        startPoint.x + boxWidth + effectSideWidth / 2,
        startPoint.y - effectHeight + effectSideWidth / 6
      ),
      new paper.Point(startPoint.x + boxWidth, startPoint.y)
    );
    navBoxEffect.lineTo(startPoint);
    this.gTier1NavGroup.addChild(navBoxEffect);

    //navBox effect orange bar full width
    const navBoxEffectBar = new paper.Path.Line({
      from: [0, navBoxTop - this.gTierSpacing],
      to: [this.gNavigatorWidth, navBoxTop - this.gTierSpacing],
      strokeColor: "#ffc000",
      strokeWidth: 4,
    });
    this.gTier1NavGroup.addChild(navBoxEffectBar);
  };

  drawTier2() {
    let secondsOnTier2 = this.gTier2SecondsPerPixel * this.gNavigatorWidth;

    this.gTier2Group.removeChildren();
    let tierBottom = this.gTier1Top + this.gTier2Height;

    // draw tier2 boarder
    // let tierRect = new paper.Rectangle(1.5, gTier2Top, gNavigatorWidth, gTier2Height);
    // let cornerSize = new paper.Size(3, 3);
    // let tierRectPath = new paper.Path.Rectangle(tierRect, cornerSize);
    // tierRectPath.strokeColor = tierBoxColor;
    // gTier2Group.addChild(tierRectPath);

    //draw tier2 video background staff lines
    let yPos = this.gTier2Top;
    for (let i = 0; i < 6; i++) {
      let staffLine = new paper.Path.Rectangle({
        from: [this.gTier2Left, yPos],
        to: [this.gNavigatorWidth, yPos + this.cChannelStrokeWidth + 1],
        strokeWidth: 1,
        strokeColor: this.gColorVideoBorder,
        // fillColor: "#3e3b44", //page body background color
      });
      yPos = yPos + this.cChannelStrokeWidth + this.cVidBarGapWidth;
      this.gTier2Group.addChild(staffLine);
    }
    //draw tier2 activity background staff lines
    const tier2EVActivityHeight = 20;
    let startY = this.gTier2Top + 7 * (this.cChannelStrokeWidth + this.cVidBarGapWidth);

    for (let i = 0; i < 3; i++) {
      let startLocY = startY + i * tier2EVActivityHeight;
      let endLocY = startLocY + tier2EVActivityHeight;
      let activityStaffLine = new paper.Path.Rectangle({
        from: [this.gTier2Left, startLocY],
        to: [this.gNavigatorWidth, endLocY],
        strokeWidth: 1,
        strokeColor: this.gColorVideoBorder,
        // fillColor: "#3e3b44", //page body background color
      });
      yPos = yPos + tier2EVActivityHeight;
      this.gTier2Group.addChild(activityStaffLine);
    }

    // draw video segments boxes
    for (let i = 0; i < this.videoFiles.length; i++) {
      //draw if video segment start is before end of viewport, and video segment end is after start of viewport
      if (
        this.videoFiles[i].missionSecondsStart <= this.gTier2StartSeconds + secondsOnTier2 &&
        this.videoFiles[i].missionSecondsEnd >= this.gTier2StartSeconds
      ) {
        let startLocX =
          this.gTier2Left +
          (this.videoFiles[i].missionSecondsStart - this.gTier2StartSeconds) *
            this.gTier2PixelsPerSecond;
        let endLocX =
          this.gTier2Left +
          (this.videoFiles[i].missionSecondsEnd - this.gTier2StartSeconds) *
            this.gTier2PixelsPerSecond;

        let startLocY =
          this.gTier2Top +
          this.videoFiles[i]["group"] * (this.cChannelStrokeWidth + this.cVidBarGapWidth);
        let endLocY = startLocY + this.cChannelStrokeWidth + 1;

        let name = "vidItem_" + i.toString();

        let vidLine = new paper.Path.Rectangle({
          from: [startLocX, startLocY],
          to: [endLocX, endLocY],
          strokeWidth: 1,
          strokeColor: this.gColorVideoBorder,
          fillColor: this.gColorVideo,
          name: name,
        });
        if (this.videoFiles[i].className === "downlink-LOS")
          vidLine.fillColor = this.gColorVideoLOS;
        this.gTier2Group.addChild(vidLine);
      }
    }

    //display time ticks
    for (
      let i = Math.round(this.gTier2StartSeconds);
      i < this.gTier2StartSeconds + secondsOnTier2;
      i++
    ) {
      if (
        parseInt(secondsToTimeStr(i).substring(3, 5)) % (10 * 60) === 0 &&
        secondsToTimeStr(i).substring(6, 8) === "00"
      ) {
        let itemSecondsFromLeft = i - this.gTier2StartSeconds;

        let itemLocX = this.gTier2Left + itemSecondsFromLeft * this.gTier2PixelsPerSecond;
        let barHeight = 10;
        let topPoint = new paper.Point(itemLocX, this.gTier2Top);
        let bottomPoint = new paper.Point(itemLocX, this.gTier2Top + barHeight);
        let aLine = new paper.Path.Line(topPoint, bottomPoint);
        aLine.strokeColor = this.gColorTimeTicks;
        this.gTier2Group.addChild(aLine);
      }
    }

    if (!isEmpty(this.activityPerformance)) {
      this.drawTier2EVActivity(0, this.activityPerformance.EV1, secondsOnTier2); // row 8 for EV1 (rows start at 0)
      this.drawTier2EVActivity(1, this.activityPerformance.EV2, secondsOnTier2); // row 9 for EV2 (rows start at 0)
    }
    if (!isNull(this.dayNight) && !isEmpty(this.dayNight.events)) {
      this.drawTier2EVActivity(2, this.dayNight.events, secondsOnTier2); // row 10 for day night  //TODO: disabled pending access to this data for all EVAs
    }

    // display photo ticks
    for (let i = 0; i < this.photoFiles.length; i++) {
      const photoTimeSeconds = secondsIntoDayFromZuluDateString(this.photoFiles[i].date_taken);
      if (
        photoTimeSeconds <= this.gTier2StartSeconds + secondsOnTier2 &&
        photoTimeSeconds >= this.gTier2StartSeconds
      ) {
        let itemLocX =
          this.gTier2Left +
          (photoTimeSeconds - this.gTier2StartSeconds) * this.gTier2PixelsPerSecond;
        let topPoint = new paper.Point(itemLocX, this.gTier2Top + this.gTier2Height - 20);
        let bottomPoint = new paper.Point(itemLocX, this.gTier2Top + this.gTier2Height - 5);
        let aLine = new paper.Path.Line(topPoint, bottomPoint);
        aLine.strokeColor = new paper.Color("green");
        aLine.strokeWidth = 2;

        this.gTier2Group.addChild(aLine);
      }
    }

    // if isToday, indicate the "future"
    if (this.isToday) {
      const secondsIntoToday = zuluDateToMissionSeconds(new Date(), this.timingData);
      const futureSecondsFromLeft = secondsIntoToday - this.gTier2StartSeconds;

      const futureLocX = futureSecondsFromLeft * this.gTier2PixelsPerSecond;
      const futureLocY = this.gTier2Top + 33;
      const futureLeftPoint = new paper.Point(futureLocX, futureLocY);
      const futureRightPoint = new paper.Point(this.gNavigatorWidth, futureLocY);
      const fLine = new paper.Path.Line(futureLeftPoint, futureRightPoint);
      fLine.strokeColor = new paper.Color(50, 50, 50, 0.1);
      fLine.strokeWidth = 110;
      fLine.dashArray = [10, 10];
      this.gTier2Group.addChild(fLine);

      // add some explanatory text
      const futureText = new paper.PointText({
        justification: "left",
        fontFamily: this.gNavigatorFontFamilyActivity,
        //fontWeight: 'bold',
        fontSize: 15,
        fillColor: "#AAAAAA",
        content: "The Future",
      });
      const textTop = this.gTier2Top + 36;
      futureText.point = new paper.Point(futureLocX - 43, textTop);
      futureText.rotate(-90);
      this.gTier2Group.addChild(futureText);
    }
  }

  drawTier2EVActivity = (evRow, evActivityArray, secondsOnTier2) => {
    const tier2EVActivityHeight = 20;
    for (let i = 0; i < evActivityArray.length; i++) {
      if (
        evActivityArray[i].startTimeSeconds <= this.gTier2StartSeconds + secondsOnTier2 &&
        evActivityArray[i].endTimeSeconds >= this.gTier2StartSeconds
      ) {
        let startLocX =
          this.gTier2Left +
          (evActivityArray[i].startTimeSeconds - this.gTier2StartSeconds) *
            this.gTier2PixelsPerSecond;
        let endLocX =
          this.gTier2Left +
          (evActivityArray[i].endTimeSeconds - this.gTier2StartSeconds) *
            this.gTier2PixelsPerSecond;

        let startY = this.gTier2Top + 7 * (this.cChannelStrokeWidth + this.cVidBarGapWidth); //there are 7 video channels, start EV activity tracking below them
        let startLocY = startY + evRow * tier2EVActivityHeight;
        let endLocY = startLocY + tier2EVActivityHeight;

        let activityLine = new paper.Path.Rectangle({
          from: [startLocX, startLocY],
          to: [endLocX, endLocY],
          strokeWidth: 0.5,
          strokeColor: this.gColorVideoBorder,
          // fillColor: gActivityBackgroundColor,
          fillColor: evActivityArray[i].color,
          name: name,
        });
        this.gTier2Group.addChild(activityLine);

        let activityText = new paper.PointText({
          justification: "left",
          fontFamily: this.gNavigatorFontFamilyActivity,
          //fontWeight: 'bold',
          fontSize: 13,
          fillColor: "white",
        });
        let textTop = startLocY + 14;
        activityText.point = new paper.Point(startLocX + 2, textTop);
        activityText.content = evActivityArray[i].content;
        if (evActivityArray[i].content === "Insolation") {
          activityText.fillColor = new paper.Color("#000000");
        }
        this.gTier2Group.addChild(activityText);
      }
    }
  };

  drawCursor = (seconds) => {
    this.gCursorGroup.removeChildren();
    this.gCursorGroup.addChild(this.getCursorElement(seconds, this.gColorCursor));
  };

  drawNavCursor = (seconds) => {
    this.gNavCursorGroup.removeChildren();
    this.gNavCursorGroup.addChild(this.getCursorElement(seconds, this.gColorNavCursor));
  };

  getCursorElement = (seconds, color) => {
    let cursorElementGroup = new paper.Group();

    // tier1
    let cursorLocX = 0.5 + seconds * this.gTier1PixelsPerSecond;
    let topPoint = new paper.Point(cursorLocX, this.gTier1Top);
    let bottomPoint = new paper.Point(cursorLocX, this.gTier1Top + this.gTier1Height - 3);
    let aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = color;
    aLine.strokeWidth = 2;
    cursorElementGroup.addChild(aLine);

    // tier2
    cursorLocX = this.gTier2Left + (seconds - this.gTier2StartSeconds) * this.gTier2PixelsPerSecond;
    topPoint = new paper.Point(cursorLocX, this.gTier2Top - 2);
    bottomPoint = new paper.Point(cursorLocX, this.gTier2Top - 2 + this.gTier2Height);
    aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = color;
    aLine.strokeWidth = 2;
    cursorElementGroup.addChild(aLine);

    let timeText = new paper.PointText({
      justification: "left",
      fontWeight: "normal",
      fontFamily: this.gNavigatorFontFamily,
      fontSize: 20,
      fillColor: "white",
    });
    timeText.content = " " + secondsToZuluString(seconds, this.timingData) + " ";
    timeText.point = new paper.Point(cursorLocX - timeText.bounds.width / 2, 20);
    const cornerSize = new paper.Size(12, 12);
    let timeTextRect = new paper.Rectangle(timeText.bounds);
    //center rectangle behind text
    timeTextRect.width = 115;
    timeTextRect.height += 5;
    timeTextRect.top -= 2;
    if (timeText.point.x < 5) {
      timeText.point.x = 5;
    } else if (timeText.point.x > this.gNavigatorWidth - timeTextRect.width - 5) {
      timeText.point.x = this.gNavigatorWidth - timeTextRect.width - 5;
    }
    timeTextRect.left = timeText.point.x;
    timeTextRect.left -= 5;
    let timeTextRectPath = new paper.Path.Rectangle(timeTextRect, cornerSize);
    //var timeTextRect = new paper.Path.Rectangle(timeText.bounds);
    // timeTextRectPath.strokeColor = new paper.Color(color);
    // timeTextRectPath.strokeWidth = 1;
    timeTextRectPath.fillColor = color;
    timeTextRectPath.opacity = 0.8;
    //timeTextRect.opacity = 0.5;
    // timeTextRectPath.scale(1.1, 1.8);
    cursorElementGroup.addChild(timeTextRectPath);
    cursorElementGroup.addChild(timeText);

    return cursorElementGroup;
  };

  setDynamicWidthVariables = () => {
    this.gNavigatorWidth = paper.view.size.width;
    this.gNavigatorHeight = paper.view.size.height;

    this.gTier1PixelsPerSecond = this.gNavigatorWidth / this.timingData["EVA_duration_seconds"];
    this.gTier1SecondsPerPixel = this.timingData["EVA_duration_seconds"] / this.gNavigatorWidth;
    this.gTier2PixelsPerSecond =
      this.gNavigatorWidth / (this.timingData["EVA_duration_seconds"] / this.gNavZoomFactor);
    this.gTier2SecondsPerPixel =
      this.timingData["EVA_duration_seconds"] / this.gNavZoomFactor / this.gNavigatorWidth;

    this.gTier1Height = 50;
    this.gTier2Height = 99;

    this.gTierSpacing = 30;

    this.gTier2Top = 30;
    this.gTier1Top = this.gTier2Top + this.gTier2Height + this.gTierSpacing;

    this.gTier1Left = 1;
    this.gTier2Left = 1;
  };

  handleMouseMove = (event, missionTimeSeconds, cb) => {
    let mouseXSeconds;
    this.gCursorGroup.removeChildren();
    this.gNavCursorGroup.removeChildren();
    if (event.point.y > this.gTier1Top) {
      //if in tier1
      mouseXSeconds = event.point.x * this.gTier1SecondsPerPixel;
      this.drawTier1NavBox(mouseXSeconds);
      this.drawTier2();
    } else {
      //if in tier 2
      mouseXSeconds =
        (event.point.x - this.gTier2Left) * this.gTier2SecondsPerPixel + this.gTier2StartSeconds;
    }
    this.drawCursor(missionTimeSeconds);
    this.drawNavCursor(mouseXSeconds);
    cb();
  };

  handleMouseUp = (event, cb: (hh: number, mm: number, ss: number) => void) => {
    let seconds = 0;
    if (event.point.y > this.gTier1Top) {
      seconds = Math.round(event.point.x * this.gTier1SecondsPerPixel);
    } else {
      //if in tier 2
      seconds = Math.round(
        (event.point.x - this.gTier2Left) * this.gTier2SecondsPerPixel + this.gTier2StartSeconds
      );
    }

    const hh = Math.floor(seconds / 3600);
    const mm = Math.floor((seconds - hh * 3600) / 60);
    const ss = seconds - hh * 3600 - mm * 60;

    this.drawCursor(seconds);
    cb(hh, mm, ss);
  };

  handleMouseLeave = (_event, cb) => {
    cb();
    this.gNavCursorGroup.removeChildren();
  };

  hasAlreadyRenderedVideos = (otherVideos: VideoFile[]): boolean => {
    const currentVideoIDs = new Map(this.videoFiles.map((vid) => [vid.id, null]));
    for (let v = 0; v < otherVideos.length; v++) {
      if (!currentVideoIDs.has(otherVideos[v].id)) {
        return false;
      }
    }
    return true;
  };
}
