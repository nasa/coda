import isNull from "lodash/isNull";
import paper from "paper";
import { appSecondsFromDateString, hhmmssFromSeconds } from "utils/formatting";

export default class DrawNav {
  gTier1Group: paper.Group;
  gTier1NavGroup: paper.Group;
  gNavBoxLocX: number;

  gTier2Group: paper.Group;
  gTier2BoarderGroup: paper.Group;
  gTier2StartSeconds: number;

  gCursorGroup: paper.Group;
  gNavCursorGroup: paper.Group;

  gNavigatorWidth: number;
  gNavigatorHeight: number;

  gCanvasHeight: number;
  gNavZoomFactor = 50;
  gTier1Height: number;
  navigatorCollapsed: boolean = false;
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

  gNavigatorFontFamily = "Ubuntu Mono";
  gNavigatorFontFamilyActivity = "Inter";

  gColorCursor = new paper.Color("#d10b0b");
  gColorNavCursor = new paper.Color("#000000");
  gColorNavBox = new paper.Color("#efefef");
  gColorBarBorder = new paper.Color("#2a282e");
  gColorVideo = new paper.Color("#999999");
  gColorVideoLOS = new paper.Color("#4e4e4e");
  gColorSgAudio = new paper.Color("#cc5500"); // Burnt orange
  gColorPhotoTicks = new paper.Color("#28B463");
  gColorPhotoTicksFiltered = new paper.Color("#0c331c");

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
    readonly isToday: boolean,
    readonly sgAudioActivityRanges: SgActivityRangeRecord[][]
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

  handleMouseMove = (event, missionTimeSeconds, cb) => {
    // scram if hovering over play pause controls area
    if (event.point.y > this.gTier1Top && event.point.x < this.gTier1Left) {
      return;
    }
    let mouseXSeconds;
    this.gCursorGroup.removeChildren();
    this.gNavCursorGroup.removeChildren();
    // this.navigatorCollapsed = false;
    this.setDynamicWidthVariables();
    if (event.point.y > this.gTier1Top) {
      //if in tier1
      mouseXSeconds = (event.point.x - this.gTier1Left) * this.gTier1SecondsPerPixel;
      if (mouseXSeconds < 0) mouseXSeconds = 0;
      this.drawNavBox(mouseXSeconds);
      this.drawTier2();
    } else {
      //if in tier 2
      mouseXSeconds =
        (event.point.x - this.gTier2Left) * this.gTier2SecondsPerPixel + this.gTier2StartSeconds;
    }
    this.drawCursor(missionTimeSeconds);
    this.drawNavCursor(mouseXSeconds);
    this.drawTier2();
    cb(mouseXSeconds);
  };

  handleMouseUp = (event, cb: (hh: number, mm: number, ss: number) => void) => {
    let seconds = 0;
    if (event.point.y > this.gTier1Top) {
      seconds = Math.round((event.point.x - this.gTier1Left) * this.gTier1SecondsPerPixel);
      if (seconds < 0) seconds = 0;
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
    // this.navigatorCollapsed = true;
    this.setDynamicWidthVariables();
    this.drawTier1();
    this.drawTier2();
    this.gNavCursorGroup.removeChildren();
    cb();
  };

  setDynamicWidthVariables = () => {
    this.gNavigatorWidth = paper.view.size.width;
    this.gNavigatorHeight = paper.view.size.height;

    this.gTier1Left = 158;
    this.gTier2Left = 0;

    this.gTier1PixelsPerSecond = (this.gNavigatorWidth - this.gTier1Left) / this.cSecondsIn24Hours;
    this.gTier1SecondsPerPixel = this.cSecondsIn24Hours / (this.gNavigatorWidth - this.gTier1Left);
    this.gTier2PixelsPerSecond =
      (this.gNavigatorWidth - this.gTier2Left) / (this.cSecondsIn24Hours / this.gNavZoomFactor);
    this.gTier2SecondsPerPixel =
      this.cSecondsIn24Hours / this.gNavZoomFactor / (this.gNavigatorWidth - this.gTier2Left);

    this.gCanvasHeight = 162;

    this.gTier1Height = 52;
    this.gTierSpacing = 2;

    if (this.navigatorCollapsed) {
      this.gTier2Height = 52;
    } else {
      this.gTier2Height = 74;
    }

    this.gTier2Top =
      this.gCanvasHeight - (this.gTier1Height + this.gTier2Height + this.gTierSpacing);
    this.gTier1Top = this.gTier2Top + this.gTier2Height + this.gTierSpacing;
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
    let cursorLocX = 0.5 + seconds * this.gTier1PixelsPerSecond + this.gTier1Left;
    let topPoint = new paper.Point(cursorLocX, this.gTier1Top + 2);
    let bottomPoint = new paper.Point(cursorLocX, this.gTier1Top + this.gTier1Height - 2);
    let aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = color;
    aLine.strokeWidth = 2;
    cursorElementGroup.addChild(aLine);

    // tier2
    cursorLocX = this.gTier2Left + (seconds - this.gTier2StartSeconds) * this.gTier2PixelsPerSecond;
    topPoint = new paper.Point(cursorLocX, this.gTier2Top - 1);
    bottomPoint = new paper.Point(cursorLocX, this.gTier2Top + this.gTier2Height);
    aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = color;
    aLine.strokeWidth = 2;
    cursorElementGroup.addChild(aLine);

    //default values for days without EVA
    let timeTextFontSize = 20;
    let timeTextYPos = this.gTier2Top - 3;
    let timeTextFontFamily = this.gNavigatorFontFamily;
    let timeTextRectWidth = 115;
    let timeTextRectHeightNudge = 5;
    let timeTextRectTopNudge = -2;

    let timeTextGroup = new paper.Group();
    // if this is an EVA day, then show PET in the cursor value
    if (!isNull(this.evaStartSec)) {
      let petText = new paper.PointText({
        justification: "left",
        fontWeight: "normal",
        fontFamily: this.gNavigatorFontFamilyActivity,
        fontSize: 12,
        fillColor: "white",
      });
      petText.content = "PET: " + hhmmssFromSeconds(Math.round(seconds - this.evaStartSec));
      petText.point = new paper.Point(cursorLocX - petText.bounds.width / 2, timeTextYPos - 15);
      timeTextGroup.addChild(petText);

      //override GMT time display with values to accommodate PET text
      timeTextFontSize = 15;
      timeTextYPos = this.gTier2Top - 3;
      timeTextFontFamily = this.gNavigatorFontFamilyActivity;
      timeTextRectWidth = 100;
      timeTextRectHeightNudge = 8;
      timeTextRectTopNudge = -5;
    }

    let timeText = new paper.PointText({
      justification: "left",
      fontWeight: "normal",
      fontFamily: timeTextFontFamily,
      fontSize: timeTextFontSize,
      fillColor: "white",
    });
    timeText.content = " " + hhmmssFromSeconds(seconds) + "Z";
    timeText.point = new paper.Point(cursorLocX - timeText.bounds.width / 2, timeTextYPos);
    const cornerSize = new paper.Size(4, 4);
    timeTextGroup.addChild(timeText);

    let timeTextRect = new paper.Rectangle(timeTextGroup.bounds);
    //center rectangle behind text
    timeTextRect.width = timeTextRectWidth;
    timeTextRect.height += timeTextRectHeightNudge;
    timeTextRect.top += timeTextRectTopNudge;
    if (timeTextGroup.position.x - timeTextGroup.bounds.width / 2 < 5) {
      timeTextGroup.position.x = 5 + timeTextGroup.bounds.width / 2;
    } else if (timeTextGroup.position.x > this.gNavigatorWidth - timeTextGroup.bounds.width / 2) {
      timeTextGroup.position.x = this.gNavigatorWidth - timeTextGroup.bounds.width / 2;
    }
    timeTextRect.left = timeTextGroup.position.x - timeTextRectWidth / 2;
    let timeTextRectPath = new paper.Path.Rectangle(timeTextRect, cornerSize);
    timeTextRectPath.fillColor = color;
    timeTextRectPath.opacity = 0.7;
    cursorElementGroup.addChild(timeTextRectPath);
    cursorElementGroup.addChild(timeTextGroup);

    return cursorElementGroup;
  };

  drawTimeTicks(param: {
    secondsStart: number;
    secondsEnd: number;
    pixelsPerSecond: number;
    leftPx: number;
    tierTop: number;
    textTop: number;
    tierTickHeight: number;
    textTickHeight: number;
  }): paper.Group {
    // display time ticks
    const group = new paper.Group();
    for (let i = param.secondsStart; i < param.secondsEnd; i++) {
      // sillily complex thing to show time ticks on the hour
      if (
        parseInt(hhmmssFromSeconds(i).substring(3, 5)) % (10 * 60) === 0 &&
        hhmmssFromSeconds(i).substring(6, 8) === "00"
      ) {
        let itemSecondsFromLeft = i - param.secondsStart;
        let itemLocX = param.leftPx + itemSecondsFromLeft * param.pixelsPerSecond;

        //draw full height faint line
        let tierTopPoint = new paper.Point(itemLocX, param.tierTop);
        let tierBottomPoint = new paper.Point(itemLocX, param.tierTop + param.tierTickHeight);
        let faintLine = new paper.Path.Line(tierTopPoint, tierBottomPoint);
        faintLine.strokeColor = new paper.Color("#505050");
        group.addChild(faintLine);

        //draw brighter tick next to hour number
        let textTopPoint = new paper.Point(itemLocX, param.textTop);
        let textBottomPoint = new paper.Point(itemLocX, param.textTop + param.textTickHeight);
        let textLine = new paper.Path.Line(textTopPoint, textBottomPoint);
        textLine.strokeColor = new paper.Color("#7b7b7b");
        group.addChild(textLine);

        //draw hour number
        const hourNumber = Math.floor(i / 3600);
        const hourText = new paper.PointText({
          justification: "left",
          fontFamily: this.gNavigatorFontFamilyActivity,
          //fontWeight: 'bold',
          fontSize: 12,
          fillColor: "#7b7b7b",
          content: hourNumber + "Z",
        });
        hourText.point = new paper.Point(itemLocX + 4, param.textTop + 10);
        group.addChild(hourText);
      }
    }
    return group;
  }

  drawDayNight(param: {
    secondsStart: number;
    secondsEnd: number;
    pixelsPerSecond: number;
    leftPx: number;
    barTop: number;
    barHeight: number;
    drawLabels: boolean;
  }): paper.Group {
    const group = new paper.Group();
    for (let i = 0; i < this.dayNight.length - 1; i++) {
      const startSeconds = this.dayNight[i].appSeconds;
      const endSeconds = this.dayNight[i + 1].appSeconds;
      const lighting: SunLighting = this.dayNight[i].daylight;

      if (startSeconds <= param.secondsEnd && endSeconds >= param.secondsStart) {
        let startLocX = param.leftPx + (startSeconds - param.secondsStart) * param.pixelsPerSecond;
        let endLocX = param.leftPx + (endSeconds - param.secondsStart) * param.pixelsPerSecond;

        let startLocY = param.barTop;
        let endLocY = startLocY + param.barHeight;

        let fillColor: string | object = "#dbc275";
        let textColor = "black";
        let activityTextContent = "";
        switch (lighting) {
          case "day":
            fillColor = "#dbc275";
            textColor = "black";
            activityTextContent = "Insolation";
            break;
          case "night":
            fillColor = "black";
            textColor = "#dddddd";
            activityTextContent = "Eclipse";
            break;
          case "sunrise":
            fillColor = {
              gradient: { stops: ["black", "#dbc275"] },
              origin: [startLocX, startLocY],
              destination: [endLocX, endLocY],
            };
            break;
          case "sunset":
            let stops = ["#dbc275", "black"];
            if (
              //edge case when it's beta high season and we don't have a full night
              typeof this.dayNight[i + 1] !== undefined &&
              this.dayNight[i + 1].daylight === "day"
            ) {
              stops = ["#dbc275", "#413A23", "#dbc275"];
            }
            fillColor = {
              gradient: { stops },
              origin: [startLocX, startLocY],
              destination: [endLocX, endLocY],
            };
            break;
          default:
            const exhaustiveCheck: never = lighting;
            throw new Error("never-check reached on sunLighting value: " + exhaustiveCheck);
        }

        let activityLine = new paper.Path.Rectangle({
          from: [startLocX, startLocY],
          to: [endLocX, endLocY],
          fillColor: fillColor,
        });
        group.addChild(activityLine);

        if (param.drawLabels) {
          let activityText = new paper.PointText({
            justification: "left",
            fontFamily: this.gNavigatorFontFamilyActivity,
            fontSize: 9,
            fillColor: textColor,
          });
          let textTop = startLocY + 8;
          activityText.point = new paper.Point(startLocX + 2, textTop);
          activityText.content = activityTextContent;
          group.addChild(activityText);
        }
      }
    }
    return group;
  }

  drawVideoSegments(param: {
    secondsStart: number;
    secondsEnd: number;
    pixelsPerSecond: number;
    leftPx: number;
    vidBarsTop: number;
    vidBarHeight: number;
    vidBarGapHeight: number;
  }): paper.Group {
    const group = new paper.Group();
    const startOfDay = this.dateRendered.valueOf() / 1000;
    for (let i = 0; i < this.videoFiles.length; i++) {
      const downlink = this.videoFiles[i].downlink === -1 ? 8 : this.videoFiles[i].downlink; // -1 means non downlink, put it on the 8th row
      if (
        // if video starts before the end of the tier display and ends after the start of the tier display, then draw a bar
        this.videoFiles[i].start - startOfDay <= param.secondsEnd &&
        this.videoFiles[i].end - startOfDay >= param.secondsStart
      ) {
        let startLocX =
          param.leftPx +
          (Math.max(this.videoFiles[i].start - startOfDay, 0) - param.secondsStart) *
            param.pixelsPerSecond;
        let endLocX =
          param.leftPx +
          (Math.min(this.videoFiles[i].end - startOfDay, 86399) - param.secondsStart) *
            param.pixelsPerSecond;

        let startLocY = param.vidBarsTop + downlink * (param.vidBarHeight + param.vidBarGapHeight);
        let endLocY = startLocY + param.vidBarHeight + 1;

        let name = "vidItem_" + i.toString();

        let vidLine = new paper.Path.Rectangle({
          from: [startLocX, startLocY],
          to: [endLocX, endLocY],
          strokeWidth: 1,
          strokeColor: this.gColorBarBorder,
          name: name,
        });
        vidLine.fillColor = this.videoFiles[i].LOS ? this.gColorVideoLOS : this.gColorVideo;

        if (downlink === 8) {
          vidLine.fillColor = new paper.Color("white");
          vidLine.opacity = 0.4;
        }
        group.addChild(vidLine);
      }
    }
    return group;
  }

  drawSgAudioSegments(param: {
    secondsStart: number;
    secondsEnd: number;
    pixelsPerSecond: number;
    leftPx: number;
    barsTop: number;
    barHeight: number;
    barGapHeight: number;
    compress: boolean;
  }): paper.Group {
    const group = new paper.Group();
    if (this.sgAudioActivityRanges.length < 4) {
      return;
    }
    for (let sgChannel = 0; sgChannel <= 3; sgChannel++) {
      const activityRanges = this.sgAudioActivityRanges[sgChannel];

      for (let i = 0; i < activityRanges.length; i++) {
        const range = activityRanges[i];
        if (
          // if video starts before the end of the tier display and ends after the start of the tier display, then draw a bar
          range.sound_start_secs <= param.secondsEnd &&
          range.sound_stop_secs >= param.secondsStart
        ) {
          let startLocX =
            param.leftPx +
            (Math.max(range.sound_start_secs, 0) - param.secondsStart) * param.pixelsPerSecond;
          let endLocX =
            param.leftPx +
            (Math.min(range.sound_stop_secs, 86399) - param.secondsStart) * param.pixelsPerSecond;

          let startLocY = null;
          let endLocY = null;
          if (param.compress) {
            startLocY = param.barsTop;
            endLocY = startLocY + param.barHeight + 0.5;
          } else {
            startLocY = param.barsTop + sgChannel * (param.barHeight + param.barGapHeight);
            endLocY = startLocY + param.barHeight + 1;
          }

          let name = `sg${sgChannel}Item_${i}`;

          let line = new paper.Path.Rectangle({
            from: [startLocX, startLocY],
            to: [endLocX, endLocY],
            strokeWidth: param.compress ? 0.1 : 1,
            strokeColor: param.compress ? this.gColorSgAudio : this.gColorBarBorder,
            name: name,
          });
          line.fillColor = this.gColorSgAudio;
          group.addChild(line);
        }
      }
    }
    return group;
  }

  drawPhotoTicks(param: {
    secondsStart: number;
    secondsEnd: number;
    pixelsPerSecond: number;
    leftPx: number;
    ticksTop: number;
    tickHeight: number;
  }): paper.Group {
    const group = new paper.Group();
    for (let i = 0; i < this.photoFiles.length; i++) {
      if (
        this.photoFiles[i].datetimeTakenAppSeconds <= param.secondsEnd &&
        this.photoFiles[i].datetimeTakenAppSeconds >= param.secondsStart
      ) {
        let showThisPhoto = false;
        for (let j = 0; j < this.collectionFilters.length; j++) {
          if (
            this.photoFiles[i].collections === this.collectionFilters[j].fullList &&
            this.collectionFilters[j].selected
          ) {
            showThisPhoto = true;
            break;
          }
        }

        let itemLocX =
          param.leftPx +
          (this.photoFiles[i].datetimeTakenAppSeconds - param.secondsStart) * param.pixelsPerSecond;
        let topPoint = new paper.Point(itemLocX, param.ticksTop + 0.5);
        let bottomPoint = new paper.Point(itemLocX, param.ticksTop + param.tickHeight);
        let aLine = new paper.Path.Line(topPoint, bottomPoint);
        if (showThisPhoto) {
          aLine.strokeColor = this.gColorPhotoTicks;
        } else {
          aLine.strokeColor = this.gColorPhotoTicksFiltered;
        }
        aLine.strokeWidth = 2;

        group.addChild(aLine);
      } else if (this.photoFiles[i].datetimeTakenAppSeconds > param.secondsEnd) {
        // break because photos are listed in temporal order and if we've passed the end of the display, the rest of the photos are not visible
        break;
      }
    }
    return group;
  }

  drawEVActivity = (param: {
    secondsStart: number;
    secondsEnd: number;
    pixelsPerSecond: number;
    leftPx: number;
    barTop: number;
    barHeight: number;
    drawLabels: boolean;
  }): paper.Group => {
    const group = new paper.Group();
    let rowCounter = 0;
    for (const key of Object.keys(this.asPerformed)) {
      const evActivityArray = this.asPerformed[key];
      for (let i = 0; i < evActivityArray.length; i++) {
        if (
          evActivityArray[i].startTimeSeconds <= param.secondsEnd &&
          evActivityArray[i].endTimeSeconds >= param.secondsStart
        ) {
          let startLocX =
            param.leftPx +
            (evActivityArray[i].startTimeSeconds - param.secondsStart) * param.pixelsPerSecond;
          let endLocX =
            param.leftPx +
            (evActivityArray[i].endTimeSeconds - param.secondsStart) * param.pixelsPerSecond;

          let startLocY = param.barTop + rowCounter * param.barHeight;
          let endLocY = startLocY + param.barHeight;

          let activityLine = new paper.Path.Rectangle({
            from: [startLocX, startLocY],
            to: [endLocX, endLocY],
            strokeWidth: 0.5,
            strokeColor: this.gColorBarBorder,
            // fillColor: gActivityBackgroundColor,
            fillColor: evActivityArray[i].color,
            name: name,
          });
          group.addChild(activityLine);

          if (param.drawLabels) {
            let activityText = new paper.PointText({
              justification: "left",
              fontFamily: this.gNavigatorFontFamilyActivity,
              //fontWeight: 'bold',
              fontSize: 9,
              fillColor: "white",
            });
            let textTop = startLocY + 8;
            activityText.point = new paper.Point(startLocX + 2, textTop);
            activityText.content = evActivityArray[i].content;
            if (evActivityArray[i].content === "Insolation") {
              activityText.fillColor = new paper.Color("#000000");
            }
            group.addChild(activityText);
          }
        }
      }
      rowCounter++;
    }
    return group;
  };

  drawPETMark = (param: {
    secondsStart: number;
    secondsEnd: number;
    pixelsPerSecond: number;
    leftPx: number;
    tierTop: number;
    tierBottom: number;
    largeLabel: boolean;
    petTime: number;
  }): paper.Group => {
    const group = new paper.Group();
    // if there is an EVA today, show PET marker
    if (!isNull(this.evaStartSec)) {
      const itemLocX = param.leftPx + (param.petTime - param.secondsStart) * param.pixelsPerSecond;
      let tierTopPoint = new paper.Point(itemLocX, param.tierTop);
      let tierBottomPoint = new paper.Point(itemLocX, param.tierBottom);
      let petLine = new paper.Path.Line(tierTopPoint, tierBottomPoint);
      petLine.strokeColor = new paper.Color("#ffffff");
      group.addChild(petLine);

      // add some explanatory text
      const petText = new paper.PointText({
        justification: "left",
        fontFamily: this.gNavigatorFontFamilyActivity,
        fillColor: "#ffffff",
        content: "PET Start",
      });
      if (param.largeLabel) {
        const textTop = param.tierBottom - 35;
        petText.point = new paper.Point(itemLocX - 33, textTop);
        petText.fontSize = 11;
      } else {
        // add some small explanatory text
        const textTop = param.tierBottom - 23;
        petText.point = new paper.Point(itemLocX - 25, textTop);
        petText.fontSize = 9;
      }
      petText.rotate(-90);

      let textRect = new paper.Rectangle(petText.bounds);
      textRect.height = param.tierBottom - param.tierTop;
      textRect.top = param.tierTop;
      if (param.largeLabel) {
        textRect.width += 4;
        textRect.left += -3;
      } else {
        textRect.left += -1;
      }
      let textRectPath = new paper.Path.Rectangle(textRect);
      textRectPath.fillColor = new paper.Color("black");
      textRectPath.opacity = 0.4;
      group.addChild(textRectPath);
      group.addChild(petText);
    }

    return group;
  };

  drawFuture = (param: {
    secondsStart: number;
    secondsEnd: number;
    pixelsPerSecond: number;
    leftPx: number;
    top: number;
    bottom: number;
    largeLabel: boolean;
    crosshatchWidth: number;
  }): paper.Group => {
    const group = new paper.Group();
    if (this.isToday) {
      const secondsIntoToday =
        appSecondsFromDateString(new Date().toISOString()) - param.secondsStart;

      const lineThickness = param.bottom - param.top;
      const futureLocX = param.leftPx + secondsIntoToday * param.pixelsPerSecond;
      const futureLocY = param.top + lineThickness / 2;
      if (futureLocY < this.gNavigatorWidth) {
        const futureLeftPoint = new paper.Point(futureLocX, futureLocY);
        const futureRightPoint = new paper.Point(this.gNavigatorWidth, futureLocY);
        const fLine = new paper.Path.Line(futureLeftPoint, futureRightPoint);
        fLine.strokeColor = new paper.Color(50, 50, 50, 0.1);
        fLine.strokeWidth = lineThickness;
        fLine.dashArray = [param.crosshatchWidth, param.crosshatchWidth];
        group.addChild(fLine);
      }

      // add some explanatory text
      const futureText = new paper.PointText({
        justification: "left",
        fontFamily: this.gNavigatorFontFamilyActivity,
        fillColor: "#AAAAAA",
        content: "The Future",
      });
      if (param.largeLabel) {
        const textTop = param.bottom - 35;
        futureText.point = new paper.Point(futureLocX - 43, textTop);
        futureText.fontSize = 12;
      } else {
        // add some small explanatory text
        const textTop = param.bottom - 23;
        futureText.point = new paper.Point(futureLocX - 25, textTop);
        futureText.fontSize = 9;
      }
      futureText.rotate(-90);
      group.addChild(futureText);
    }
    return group;
  };

  drawTier1() {
    this.gTier1Group.removeChildren();

    const drawingTop = this.gTier1Top + 0.5;
    const drawingBottom = this.gTier1Top + this.gTier1Height - this.gTierSpacing + 0.5;
    const drawingHeight = this.gTier1Height;

    const pixelsPerSecond = this.gTier1PixelsPerSecond;
    const secondsStart = 0;
    const secondsEnd = this.cSecondsIn24Hours;
    const leftPx = this.gTier1Left;

    this.gTier1Group.addChild(
      this.drawVideoSegments({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        vidBarsTop: drawingTop,
        vidBarHeight: 2,
        vidBarGapHeight: 1,
      })
    );

    this.gTier1Group.addChild(
      this.drawSgAudioSegments({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        barsTop: drawingBottom - 23,
        barHeight: 2,
        barGapHeight: 1,
        compress: true,
      })
    );

    this.gTier1Group.addChild(
      this.drawDayNight({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        barTop: drawingBottom - 12.5,
        barHeight: 2,
        drawLabels: false,
      })
    );

    this.gTier1Group.addChild(
      this.drawPhotoTicks({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        ticksTop: drawingBottom - 14.5,
        tickHeight: 3,
      })
    );

    this.gTier1Group.addChild(
      this.drawEVActivity({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        barTop: drawingBottom - 20.5,
        barHeight: 3,
        drawLabels: false,
      })
    );

    this.gTier1Group.addChild(
      this.drawFuture({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        top: this.gTier1Top,
        bottom: this.gTier1Top + this.gTier1Height,
        largeLabel: false,
        crosshatchWidth: 2,
      })
    );

    this.gTier1Group.addChild(
      this.drawTimeTicks({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        tierTop: this.gTier1Top,
        textTop: drawingBottom - 10,
        tierTickHeight: drawingHeight,
        textTickHeight: 10,
      })
    );

    this.gTier1Group.addChild(
      this.drawPETMark({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        tierTop: this.gTier1Top,
        tierBottom: this.gTier1Top + this.gTier1Height,
        largeLabel: false,
        petTime: this.evaStartSec,
      })
    );
  }

  drawTier2() {
    this.gTier2Group.removeChildren();

    const drawingBottom = this.gTier2Top + this.gTier2Height + 0.5;
    const drawingHeight = this.gTier2Height;

    const drawLabels = !this.navigatorCollapsed;

    const pixelsPerSecond = this.gTier2PixelsPerSecond;
    const secondsStart = this.gTier2StartSeconds;
    const secondsEnd = this.gTier2StartSeconds + this.gTier2SecondsPerPixel * this.gNavigatorWidth;

    const leftPx = this.gTier2Left;

    this.gTier2Group.addChild(
      this.drawVideoSegments({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        vidBarsTop: drawingBottom - 69,
        vidBarHeight: 2,
        vidBarGapHeight: 1,
      })
    );

    this.gTier2Group.addChild(
      this.drawSgAudioSegments({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        barsTop: drawingBottom - 42,
        barHeight: 2,
        barGapHeight: 1,
        compress: false,
      })
    );

    this.gTier2Group.addChild(
      this.drawDayNight({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        barTop: drawingBottom - 10,
        barHeight: this.navigatorCollapsed ? 2 : 10,
        drawLabels,
      })
    );

    this.gTier2Group.addChild(
      this.drawPhotoTicks({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        ticksTop: drawingBottom - 11,
        tickHeight: this.navigatorCollapsed ? 3 : 8,
      })
    );

    this.gTier2Group.addChild(
      this.drawEVActivity({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        barTop: drawingBottom - 30,
        barHeight: this.navigatorCollapsed ? 2 : 10,
        drawLabels,
      })
    );

    this.gTier2Group.addChild(
      this.drawFuture({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        top: this.gTier2Top,
        bottom: drawingBottom,
        largeLabel: true,
        crosshatchWidth: 10,
      })
    );

    this.gTier2Group.addChild(
      this.drawTimeTicks({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        tierTop: this.gTier2Top,
        textTop: drawingBottom - 12,
        tierTickHeight: drawingHeight,
        textTickHeight: 10,
      })
    );

    this.gTier2Group.addChild(
      this.drawPETMark({
        secondsStart,
        secondsEnd,
        pixelsPerSecond,
        leftPx,
        tierTop: this.gTier2Top,
        tierBottom: this.gTier2Top + this.gTier2Height,
        largeLabel: true,
        petTime: this.evaStartSec,
      })
    );
  }

  drawNavBox = (seconds) => {
    this.gTier1NavGroup.removeChildren();

    let locX = seconds * this.gTier1PixelsPerSecond + this.gTier1Left;
    let navBoxWidth = (this.gNavigatorWidth - this.gTier1Left) / this.gNavZoomFactor;
    this.gNavBoxLocX = locX - navBoxWidth / 2;
    if (this.gNavBoxLocX < this.gTier1Left) {
      this.gNavBoxLocX = this.gTier1Left;
    } else if (this.gNavBoxLocX + navBoxWidth > this.gNavigatorWidth) {
      this.gNavBoxLocX = this.gNavigatorWidth - navBoxWidth;
    }
    this.gTier2StartSeconds = this.gTier1SecondsPerPixel * (this.gNavBoxLocX - this.gTier1Left);

    const navBoxTop = this.gTier1Top;
    const navBoxHeight = this.gTier1Height;
    let navBoxRect = new paper.Rectangle(this.gNavBoxLocX, navBoxTop, navBoxWidth, navBoxHeight);
    const cornerSize = new paper.Size(3, 3);
    let navBoxRectPath = new paper.Path.Rectangle(navBoxRect, cornerSize);
    navBoxRectPath.strokeColor = this.gColorNavBox;
    navBoxRectPath.strokeWidth = 2;
    this.gTier1NavGroup.addChild(navBoxRectPath);

    //left navBoxEffect
    const effectHeight = 20;
    let startPoint = new paper.Point(this.gNavBoxLocX, this.gTier1Top + effectHeight);
    const effectSideWidth = 20;
    let navBoxEffectLeft = new paper.Path({
      strokeColor: this.gColorNavBox,
      closed: false,
      fillColor: "#efefef",
      strokeWidth: 2,
    });
    navBoxEffectLeft.add(startPoint);
    navBoxEffectLeft.arcTo(
      new paper.Point(startPoint.x - effectSideWidth / 1.2, startPoint.y - effectHeight),
      new paper.Point(startPoint.x - effectSideWidth, startPoint.y - effectHeight)
    );
    navBoxEffectLeft.lineTo(new paper.Point(startPoint.x, startPoint.y - effectHeight));
    this.gTier1NavGroup.addChild(navBoxEffectLeft);

    //right navBoxEffect
    startPoint = new paper.Point(this.gNavBoxLocX + navBoxWidth, this.gTier1Top + effectHeight);
    let navBoxEffectRight = new paper.Path({
      strokeColor: this.gColorNavBox,
      closed: false,
      fillColor: this.gColorNavBox,
      strokeWidth: 2,
    });
    navBoxEffectRight.add(startPoint);
    navBoxEffectRight.arcTo(
      new paper.Point(startPoint.x + effectSideWidth / 1.2, startPoint.y - effectHeight),
      new paper.Point(startPoint.x + effectSideWidth, startPoint.y - effectHeight)
    );
    navBoxEffectRight.lineTo(new paper.Point(startPoint.x, startPoint.y - effectHeight));
    this.gTier1NavGroup.addChild(navBoxEffectRight);

    //Timeline separator bar full width
    const navBoxEffectBar = new paper.Path.Line({
      from: [0, this.gTier1Top],
      to: [this.gNavigatorWidth, this.gTier1Top],
      strokeColor: this.gColorNavBox,
      strokeWidth: this.gTierSpacing,
    });
    this.gTier1NavGroup.addChild(navBoxEffectBar);
  };
}
