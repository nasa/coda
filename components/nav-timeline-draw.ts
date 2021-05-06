import isEmpty from "lodash/isEmpty";
import isNull from "lodash/isNull";
import paper from "paper";
import { appSecondsFromDateString, hhmmssFromSeconds } from "utils/formatting";
import type { CollectionFilters } from "store/photos";
import type { VideoFile, PhotoFile } from "typings/io";
import type { DayNightObj } from "typings/spacetrack";
import { Activity } from "typings/wiki";

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

  gColorCursor = new paper.Color("#d10b0b");
  gColorNavCursor = new paper.Color("#19181b");
  gColorTimeTicks = new paper.Color("#7b7b7b");
  gColorPhotoTicks = new paper.Color("#28B463");
  gColorPhotoTicksFiltered = new paper.Color("#0c331c");
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

  cSecondsIn24Hours = 86400;

  constructor(
    readonly videoFiles: VideoFile[],
    readonly photoFiles: PhotoFile[],
    readonly collectionFilters: CollectionFilters[],
    readonly dayNight: DayNightObj[],
    readonly activityPerformance: {
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

  drawTier1() {
    this.gTier1Group.removeChildren();

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
        aLine.strokeColor = this.gColorTimeTicks;

        this.gTier1Group.addChild(aLine);
      }
    }

    // display video segments
    const videoSegmentsTop = this.gTier1Top + 2;
    for (let i = 0; i < this.videoFiles.length; i++) {
      let startLocX = this.videoFiles[i].missionSecondsStart * this.gTier1PixelsPerSecond;
      let endLocX = this.videoFiles[i].missionSecondsEnd * this.gTier1PixelsPerSecond;

      let startLocY =
        videoSegmentsTop +
        this.videoFiles[i].group * (this.cChannelStrokeWidth - 1 + this.cVidBarGapWidth);
      let endLocY = startLocY + this.cChannelStrokeWidth - 1;

      const name = "vidItem_" + i.toString();

      let vidLine = new paper.Path.Rectangle({
        from: [startLocX, startLocY],
        to: [endLocX, endLocY],
        strokeWidth: 0.1,
        strokeColor: this.gColorVideoBorder,
        name,
      });
      vidLine.fillColor =
        this.videoFiles[i].className === "downlink-LOS" ? this.gColorVideoLOS : this.gColorVideo;

      if (this.videoFiles[i].group === 6) {
        vidLine.fillColor = new paper.Color("white");
        vidLine.opacity = 0.4;
      }
      this.gTier1Group.addChild(vidLine);
    }

    // display EV activity
    if (!isEmpty(this.activityPerformance)) {
      this.drawTier1EVActivity(7, this.activityPerformance.EV1); // row 8 for EV1 (rows start at 0)
      this.drawTier1EVActivity(8, this.activityPerformance.EV2); // row 9 for EV2 (rows start at 0)
    }

    //dayNight
    for (let i = 0; i < this.dayNight.length - 1; i++) {
      const startSeconds = this.dayNight[i].appSeconds;
      const endSeconds = this.dayNight[i + 1].appSeconds;
      const fillColor = this.dayNight[i].daylight ? "#dbc275" : "black";

      let startLocX = startSeconds * this.gTier1PixelsPerSecond;
      let endLocX = endSeconds * this.gTier1PixelsPerSecond;
      let startLocY = videoSegmentsTop + 9 * (this.cChannelStrokeWidth - 1 + this.cVidBarGapWidth);
      let endLocY = startLocY + this.cChannelStrokeWidth - 1;
      let activityLine = new paper.Path.Rectangle({
        from: [startLocX, startLocY],
        to: [endLocX, endLocY],
        strokeWidth: 0.1,
        strokeColor: "black",
        fillColor: fillColor,
      });
      this.gTier1Group.addChild(activityLine);
    }

    // display photo ticks
    const rowNum = 10; //
    // track x locations to avoid rendering multiple lines on the same pixel
    const xLocations = new Set();
    for (let i = 0; i < this.photoFiles.length; i++) {
      let itemLocX = this.photoFiles[i].dateTakenAppSeconds * this.gTier1PixelsPerSecond;
      const wholePixelLocation = Math.round(itemLocX);
      if (xLocations.has(wholePixelLocation)) {
        continue;
      }
      xLocations.add(wholePixelLocation);

      let showThisPhoto = false;
      for (let j = 0; j < this.collectionFilters.length; j++) {
        if (
          this.photoFiles[i].collections_string === this.collectionFilters[j].fullList &&
          this.collectionFilters[j].selected
        ) {
          showThisPhoto = true;
          break;
        }
      }

      const startLocY =
        this.gTier1Top + 1 + rowNum * (this.cChannelStrokeWidth - 1 + this.cVidBarGapWidth);
      const topPoint = new paper.Point(itemLocX, startLocY);
      let bottomPoint = new paper.Point(itemLocX, startLocY + this.cChannelStrokeWidth - 1);
      let aLine = new paper.Path.Line(topPoint, bottomPoint);
      if (showThisPhoto) {
        aLine.strokeColor = this.gColorPhotoTicks;
      } else {
        aLine.strokeColor = this.gColorPhotoTicksFiltered;
      }

      this.gTier1Group.addChild(aLine);
    }

    if (!isNull(this.evaStartSec)) {
      for (let i = 0; i < this.cSecondsIn24Hours; i++) {
        if (i === this.evaStartSec) {
          let itemLocX = i * this.gTier1PixelsPerSecond;
          let topPoint = new paper.Point(itemLocX, this.gTier1Top);
          let bottomPoint = new paper.Point(itemLocX, this.gTier1Top + this.gTier1Height - 3);
          let aLine = new paper.Path.Line(topPoint, bottomPoint);
          aLine.strokeColor = new paper.Color("white");
          this.gTier1Group.addChild(aLine);
          break;
        }
      }
    }
  }

  drawTier1Future() {
    // if isToday, indicate the "future" (https://www.youtube.com/watch?v=VVle0kopfes)
    if (this.isToday) {
      this.gTier1FutureGroup.removeChildren();
      const secondsIntoToday = appSecondsFromDateString(new Date().toISOString());

      let futureLocX = 0.5 + secondsIntoToday * this.gTier1PixelsPerSecond;
      const futureLocY = this.gTier1Top + 15;
      const futureLeftPoint = new paper.Point(futureLocX, futureLocY);
      const futureRightPoint = new paper.Point(this.gNavigatorWidth, futureLocY);
      const fLine = new paper.Path.Line(futureLeftPoint, futureRightPoint);
      fLine.strokeColor = new paper.Color(50, 50, 50, 0.1);
      fLine.strokeWidth = 90;
      fLine.dashArray = [2, 2];
      this.gTier1FutureGroup.addChild(fLine);
    }
  }

  drawTier1EVActivity(rowNum, evActivityArray: Activity[]) {
    const videoSegmentsTop = this.gTier1Top + 2;
    for (let i = 0; i < evActivityArray.length; i++) {
      let startLocX = evActivityArray[i].startTimeSeconds * this.gTier1PixelsPerSecond;
      let endLocX = evActivityArray[i].endTimeSeconds * this.gTier1PixelsPerSecond;
      let startLocY =
        videoSegmentsTop + rowNum * (this.cChannelStrokeWidth - 1 + this.cVidBarGapWidth);
      let endLocY = startLocY + this.cChannelStrokeWidth - 1;
      let activityLine = new paper.Path.Rectangle({
        from: [startLocX, startLocY],
        to: [endLocX, endLocY],
        strokeWidth: 0.1,
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
          name: name,
        });
        vidLine.fillColor =
          this.videoFiles[i].className === "downlink-LOS" ? this.gColorVideoLOS : this.gColorVideo;

        if (this.videoFiles[i].group === 6) {
          vidLine.fillColor = new paper.Color("white");
          vidLine.opacity = 0.4;
        }
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
        parseInt(hhmmssFromSeconds(i).substring(3, 5)) % (10 * 60) === 0 &&
        hhmmssFromSeconds(i).substring(6, 8) === "00"
      ) {
        let itemSecondsFromLeft = i - this.gTier2StartSeconds;

        let itemLocX = this.gTier2Left + itemSecondsFromLeft * this.gTier2PixelsPerSecond;
        let barHeight = 10;
        let topPoint = new paper.Point(itemLocX, this.gTier2Top);
        let bottomPoint = new paper.Point(itemLocX, this.gTier2Top + barHeight);
        let aLine = new paper.Path.Line(topPoint, bottomPoint);
        aLine.strokeColor = this.gColorTimeTicks;
        this.gTier2Group.addChild(aLine);

        // add some explanatory text
        const timeText = new paper.PointText({
          justification: "left",
          fontFamily: this.gNavigatorFontFamilyActivity,
          //fontWeight: 'bold',
          fontSize: 15,
          fillColor: this.gColorTimeTicks,
          content: hhmmssFromSeconds(i),
        });
        const textTop = this.gTier2Top + 50;
        timeText.point = new paper.Point(itemLocX - 32, textTop);
        timeText.rotate(-90);
        this.gTier2Group.addChild(timeText);
      }
    }

    if (!isEmpty(this.activityPerformance)) {
      this.drawTier2EVActivity(0, this.activityPerformance.EV1, secondsOnTier2); // row 8 for EV1 (rows start at 0)
      this.drawTier2EVActivity(1, this.activityPerformance.EV2, secondsOnTier2); // row 9 for EV2 (rows start at 0)
    }

    //dayNight
    const dayNightHeight = 20;
    for (let i = 0; i < this.dayNight.length - 1; i++) {
      const startSeconds = this.dayNight[i].appSeconds;
      const endSeconds = this.dayNight[i + 1].appSeconds;
      const fillColor = this.dayNight[i].daylight ? "#dbc275" : "black";
      const textColor = this.dayNight[i].daylight ? "black" : "#dddddd";
      if (
        startSeconds <= this.gTier2StartSeconds + secondsOnTier2 &&
        endSeconds >= this.gTier2StartSeconds
      ) {
        let startLocX =
          this.gTier2Left + (startSeconds - this.gTier2StartSeconds) * this.gTier2PixelsPerSecond;
        let endLocX =
          this.gTier2Left + (endSeconds - this.gTier2StartSeconds) * this.gTier2PixelsPerSecond;

        let startY = this.gTier2Top + 7 * (this.cChannelStrokeWidth + this.cVidBarGapWidth); //there are 7 video channels, start EV activity tracking below them
        let startLocY = startY + 2 * dayNightHeight;
        let endLocY = startLocY + dayNightHeight;

        let activityLine = new paper.Path.Rectangle({
          from: [startLocX, startLocY],
          to: [endLocX, endLocY],
          strokeWidth: 0.5,
          strokeColor: this.gColorVideoBorder,
          fillColor: fillColor,
        });
        this.gTier2Group.addChild(activityLine);

        let activityText = new paper.PointText({
          justification: "left",
          fontFamily: this.gNavigatorFontFamilyActivity,
          fontSize: 13,
          fillColor: textColor,
        });
        let textTop = startLocY + 14;
        activityText.point = new paper.Point(startLocX + 2, textTop);
        activityText.content = this.dayNight[i].daylight ? "Insolation" : "Eclipse";
        this.gTier2Group.addChild(activityText);
      }
    }

    // display photo ticks
    for (let i = 0; i < this.photoFiles.length; i++) {
      if (
        this.photoFiles[i].dateTakenAppSeconds <= this.gTier2StartSeconds + secondsOnTier2 &&
        this.photoFiles[i].dateTakenAppSeconds >= this.gTier2StartSeconds
      ) {
        let showThisPhoto = false;
        for (let j = 0; j < this.collectionFilters.length; j++) {
          if (
            this.photoFiles[i].collections_string === this.collectionFilters[j].fullList &&
            this.collectionFilters[j].selected
          ) {
            showThisPhoto = true;
            break;
          }
        }

        let itemLocX =
          this.gTier2Left +
          (this.photoFiles[i].dateTakenAppSeconds - this.gTier2StartSeconds) *
            this.gTier2PixelsPerSecond;
        let topPoint = new paper.Point(itemLocX, this.gTier2Top + this.gTier2Height - 13);
        let bottomPoint = new paper.Point(itemLocX, this.gTier2Top + this.gTier2Height - 5);
        let aLine = new paper.Path.Line(topPoint, bottomPoint);
        if (showThisPhoto) {
          aLine.strokeColor = this.gColorPhotoTicks;
        } else {
          aLine.strokeColor = this.gColorPhotoTicksFiltered;
        }
        aLine.strokeWidth = 2;

        this.gTier2Group.addChild(aLine);
      } else if (
        this.photoFiles[i].dateTakenAppSeconds >
        this.gTier2StartSeconds + secondsOnTier2
      ) {
        break;
      }
    }

    // if isToday, indicate the "future"
    if (this.isToday) {
      const secondsIntoToday = appSecondsFromDateString(new Date().toISOString());
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

    // if there is an EVA today, show PET marker
    if (!isNull(this.evaStartSec)) {
      for (
        let i = Math.round(this.gTier2StartSeconds);
        i < this.gTier2StartSeconds + secondsOnTier2;
        i++
      ) {
        if (i === this.evaStartSec) {
          let itemSecondsFromLeft = i - this.gTier2StartSeconds;

          let itemLocX = this.gTier2Left + itemSecondsFromLeft * this.gTier2PixelsPerSecond;
          let topPoint = new paper.Point(itemLocX, this.gTier2Top);
          let bottomPoint = new paper.Point(itemLocX, this.gTier2Top - 2 + this.gTier2Height);
          let aLine = new paper.Path.Line(topPoint, bottomPoint);
          aLine.strokeColor = new paper.Color("white");
          this.gTier2Group.addChild(aLine);

          // add some explanatory text
          const text = new paper.PointText({
            justification: "left",
            fontFamily: this.gNavigatorFontFamilyActivity,
            //fontWeight: 'bold',
            fontSize: 15,
            fillColor: "white",
            content: "PET Start",
          });
          const textTop = this.gTier2Top + 50;
          text.point = new paper.Point(itemLocX - 45, textTop);
          text.rotate(-90);

          let textRect = new paper.Rectangle(text.bounds);
          textRect.height = this.gTier2Height - 5;
          textRect.top = this.gTier2Top;
          textRect.width += 5;
          textRect.left += -3;

          let textRectPath = new paper.Path.Rectangle(textRect);

          textRectPath.fillColor = new paper.Color("black");
          textRectPath.opacity = 0.4;

          this.gTier2Group.addChild(textRectPath);
          this.gTier2Group.addChild(text);

          break;
        }
      }
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

    //default values for days without EVA
    let timeTextFontSize = 20;
    let timeTextYPos = 20;
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
      petText.point = new paper.Point(cursorLocX - petText.bounds.width / 2, 18);
      timeTextGroup.addChild(petText);

      //override GMT time display with values to accommodate PET text
      timeTextFontSize = 15;
      timeTextYPos = 35;
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
    cb(mouseXSeconds);
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
