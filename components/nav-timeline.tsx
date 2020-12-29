import { useRouter } from "next/router";
import paper from "paper";
import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Activity } from "services/iss-wiki";
import { ClockState, getMissionTime, historySelector } from "store/clock";
import { EVAsState, selectEVAStartMilliseconds } from "store/evas";
import {
  selectVideoItems,
  selectVideoTimingData,
  VideosState,
} from "store/videos";
import { secondsToTimeStr, secondsToZuluString } from "../utils/formatting";

let gCurrMissionTimeSeconds = 0;
const gSelectedVidGroup = [];
const loadVideo = (_a, _b, _c) => {};

let interval = null;
let renderedGMT = 0;

/**
 * Renders the navigation timeline presented at the top of the CODA window
 */
function NavTimeline() {
  const {
    query: { gmt = null, pet = null },
  }: {
    query: {
      gmt?: number;
      pet?: number;
    };
  } = useRouter();
  const {
    clock,
    evas,
    videos,
  }: {
    clock: ClockState;
    evas: EVAsState;
    videos: VideosState;
  } = useSelector((state) => state);
  const timingData = selectVideoTimingData(videos);
  const videoItems = selectVideoItems(videos);
  const activityStartUTCMilliseconds = selectEVAStartMilliseconds(evas);
  const activityPerformance = evas.EVAs[evas.selectedEVA].activityPerformance;

  let missionTime = 0;
  useEffect(() => {
    const interval = setInterval(() => {
      missionTime = getMissionTime(historySelector(clock));
      // console.log(missionTime);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // get activity times in the mission timeframe
  let thisStartTimeSeconds =
    (activityStartUTCMilliseconds - timingData.video_earliestStart.getTime()) /
    1000;
  for (let a = 0; a < activityPerformance.EV1.length; a++) {
    const activity = activityPerformance.EV1[a];
    activityPerformance.EV1[a].startTimeSeconds = thisStartTimeSeconds;
    activityPerformance.EV1[a].endTimeSeconds =
      thisStartTimeSeconds + activity.duration;
    thisStartTimeSeconds = thisStartTimeSeconds + activity.duration;
  }
  thisStartTimeSeconds =
    (activityStartUTCMilliseconds - timingData.video_earliestStart.getTime()) /
    1000;
  for (let a = 0; a < activityPerformance.EV2.length; a++) {
    const activity = activityPerformance.EV2[a];
    activityPerformance.EV2[a].startTimeSeconds = thisStartTimeSeconds;
    activityPerformance.EV2[a].endTimeSeconds =
      thisStartTimeSeconds + activity.duration;
    thisStartTimeSeconds = thisStartTimeSeconds + activity.duration;
  }

  // get video times in the mission timeframe
  for (let i = 0; i < videoItems.length; i++) {
    videoItems[i].missionSecondsStart =
      (new Date(videoItems[i].start).getTime() -
        timingData.video_earliestStart.getTime()) /
      1000;
    videoItems[i].missionSecondsEnd =
      (new Date(videoItems[i].end).getTime() -
        timingData.video_earliestStart.getTime()) /
      1000;
    videoItems[i].durationSeconds =
      videoItems[i].missionSecondsEnd - videoItems[i].missionSecondsStart;
  }

  let gTier1Group;
  let gTier1NavGroup;
  let gTier1NavBoxLocX;

  let gTier2Group;
  let gTier2BoarderGroup;
  let gTier2StartSeconds;

  let gCursorGroup;
  let gNavCursorGroup;

  let gNavigatorWidth;
  let gNavigatorHeight;

  let gNavZoomFactor = 25;
  let gTier1Height;
  let gTier2Height;
  let gTier1PixelsPerSecond;
  let gTier1SecondsPerPixel;
  let gTier2PixelsPerSecond;
  let gTier2SecondsPerPixel;

  let gTierSpacing;
  let gTier1Top;
  let gTier2Top;
  let gTier1Left;
  let gTier2Left;

  let gColorCursor = new paper.Color("#00ff00");
  let gColorNavCursor = new paper.Color("#ffff00"); //'yellow';
  let gColorTimeTicks = new paper.Color("#7b7b7b");
  let gColorVideo = new paper.Color("#999999");
  let gColorVideoLOS = new paper.Color("#4e4e4e");
  let tierBoxColor = new paper.Color("#999999");
  let gColorZoomPane1Border = new paper.Color("#5E92A6");
  let gColorZoomPane2Border = new paper.Color("#84b8d9");
  let gActivityBackgroundColor = new paper.Color("#eb272b");
  let gDayColor = new paper.Color("#e6e600");
  let gNightColor = new paper.Color("#444444");
  let gAlphaRectOpacity = 0.4;
  let gNaxBoxZoomFadeOpacity = 0.2;

  let gNavigatorFontFamily = "Roboto Mono";

  let cChannelStrokeWidth = 4;
  let cVidBarGapWidth = 1;

  let gMouseOnNavigator;

  const drawTier1 = () => {
    gTier1Group.removeChildren();
    var tierRect = new paper.Rectangle(
      gTier1Left,
      gTier1Top,
      gNavigatorWidth,
      gTier1Height
    );
    var cornerSize = new paper.Size(5, 5);
    var tierRectPath = paper.Path.RoundRectangle(tierRect, cornerSize);
    //var tierRectPath = paper.Path.Rectangle(tierRect);
    tierRectPath.strokeColor = tierBoxColor;
    gTier1Group.addChild(tierRectPath);

    //display time ticks
    for (var i = 0; i < timingData["EVA_duration_seconds"]; i++) {
      // sillily complex thing to show time ticks on the hour
      if (
        parseInt(secondsToTimeStr(i).substring(3, 5)) % (10 * 60) === 0 &&
        secondsToTimeStr(i).substring(6, 8) === "00"
      ) {
        var itemLocX = i * gTier1PixelsPerSecond;
        var topPoint = new paper.Point(itemLocX, 1);
        var bottomPoint = new paper.Point(itemLocX, 10);
        var aLine = new paper.Path.Line(topPoint, bottomPoint);
        aLine.strokeColor = gColorTimeTicks;

        gTier1Group.addChild(aLine);
      }
    }

    //display video segments
    for (i = 0; i < videoItems.length; i++) {
      var startLocX = videoItems[i].missionSecondsStart * gTier1PixelsPerSecond;
      var endLocX = videoItems[i].missionSecondsEnd * gTier1PixelsPerSecond;

      var startLocY =
        0.5 + videoItems[i]["group"] * (cChannelStrokeWidth + cVidBarGapWidth);
      var endLocY = startLocY + cChannelStrokeWidth + 1;

      const name = "vidItem_" + i.toString();

      var vidLine = new paper.Path.Rectangle({
        from: [startLocX, startLocY],
        to: [endLocX, endLocY],
        strokeWidth: 0.5,
        strokeColor: "black",
        fillColor: gColorVideo,
        name,
      });
      if (videoItems[i].className === "downlink-LOS")
        vidLine.fillColor = gColorVideoLOS;
      gTier1Group.addChild(vidLine);
    }

    //display EV activity

    drawTier1EVActivity(7, activityPerformance.EV1); // row 8 for EV1 (rows start at 0)
    drawTier1EVActivity(8, activityPerformance.EV2); // row 9 for EV2 (rows start at 0)
    // drawTier1EVActivity(9, activityPerformance.DayNight); // row 10 for day night  //TODO: disabled pending access to this data for all EVAs
  };

  const drawTier1EVActivity = (rowNum, evActivityArray: Activity[]) => {
    for (var i = 0; i < evActivityArray.length; i++) {
      var startLocX =
        evActivityArray[i].startTimeSeconds * gTier1PixelsPerSecond;
      var endLocX = evActivityArray[i].endTimeSeconds * gTier1PixelsPerSecond;
      var startLocY = 0.5 + rowNum * (cChannelStrokeWidth + cVidBarGapWidth);
      var endLocY = startLocY + cChannelStrokeWidth + 1;
      var activityLine = new paper.Path.Rectangle({
        from: [startLocX, startLocY],
        to: [endLocX, endLocY],
        strokeWidth: 0.5,
        strokeColor: "black",
        // fillColor: gActivityBackgroundColor,
        fillColor: evActivityArray[i].color,
        // name: name,
      });
      if (evActivityArray[i].content === "Insolation") {
        activityLine.fillColor = gDayColor;
      } else if (evActivityArray[i].content === "Eclipse") {
        activityLine.fillColor = gNightColor;
      }
      gTier1Group.addChild(activityLine);
    }
  };

  const drawTier1NavBox = (seconds) => {
    gTier1NavGroup.removeChildren();

    var locX = seconds * gTier1PixelsPerSecond;
    var navBoxWidth = gNavigatorWidth / gNavZoomFactor;
    gTier1NavBoxLocX = locX - navBoxWidth / 2;
    if (gTier1NavBoxLocX < 0) {
      gTier1NavBoxLocX = 0;
    } else if (gTier1NavBoxLocX + navBoxWidth > gNavigatorWidth) {
      gTier1NavBoxLocX = gNavigatorWidth - navBoxWidth;
    }
    gTier2StartSeconds = gTier1SecondsPerPixel * gTier1NavBoxLocX;

    var navBoxRect = new paper.Rectangle(
      gTier1NavBoxLocX,
      1.5,
      navBoxWidth,
      gTier1Height
    );
    var cornerSize = new paper.Size(2, 2);
    var navBoxRectPath = paper.Path.RoundRectangle(navBoxRect, cornerSize);
    //var navBoxRectPath = paper.Path.Rectangle(navBoxRect);
    navBoxRectPath.strokeColor = gColorZoomPane1Border;
    gTier1NavGroup.addChild(navBoxRectPath);

    var leftAlphaRect = new paper.Rectangle(
      gTier1Left,
      gTier1Top,
      gTier1NavBoxLocX - gTier1Left,
      gTier1Height
    );
    var leftAlphaRectPath = paper.Path.RoundRectangle(
      leftAlphaRect,
      cornerSize
    );
    leftAlphaRectPath.fillColor = new paper.Color(0, 0, 0, gAlphaRectOpacity);
    gTier1NavGroup.addChild(leftAlphaRectPath);

    var rightAlphaRect = new paper.Rectangle(
      gTier1NavBoxLocX + navBoxWidth,
      gTier1Top,
      gNavigatorWidth - gTier1NavBoxLocX + navBoxWidth,
      gTier1Height
    );
    var rightAlphaRectPath = paper.Path.RoundRectangle(
      rightAlphaRect,
      cornerSize
    );
    rightAlphaRectPath.fillColor = new paper.Color(0, 0, 0, gAlphaRectOpacity);
    gTier1NavGroup.addChild(rightAlphaRectPath);

    //add zoom curves
    var leftCurveObj = new paper.Path({
      segments: [
        [gTier1NavBoxLocX, gTier1Top + gTier1Height / 2],
        [gTier2Left, gTier2Top],
        [gTier1NavBoxLocX, gTier2Top],
      ],

      strokeColor: "white",
      // closed: true,
      strokeWidth: 1,
      strokeJoin: "round",
      fillColor: "white",
      opacity: gNaxBoxZoomFadeOpacity,
    });
    var handleVector = new paper.Point({
      angle: 90,
      length: gTier1Height,
    });
    leftCurveObj.segments[0].handleOut = handleVector;
    gTier1NavGroup.addChild(leftCurveObj);

    var rightCurveObj = new paper.Path({
      segments: [
        [gTier1NavBoxLocX + navBoxWidth, gTier1Top + gTier1Height / 2],
        [gNavigatorWidth, gTier2Top],
        [gTier1NavBoxLocX + navBoxWidth, gTier2Top],
      ],

      strokeColor: "white",
      // closed: true,
      strokeWidth: 1,
      strokeJoin: "round",
      fillColor: "white",
      opacity: gNaxBoxZoomFadeOpacity,
    });
    rightCurveObj.segments[0].handleOut = handleVector;
    gTier1NavGroup.addChild(rightCurveObj);

    var fillUnderNavBox = new paper.Path({
      segments: [
        [gTier1NavBoxLocX + 0.5, gTier1Top + gTier1Height],
        [gTier1NavBoxLocX + 0.5, gTier2Top],
        [gTier1NavBoxLocX + navBoxWidth - 0.5, gTier2Top],
        [gTier1NavBoxLocX + navBoxWidth - 0.5, gTier1Top + gTier1Height],
      ],
      strokeColor: "white",
      closed: true,
      strokeWidth: 1,
      // strokeJoin: 'round',
      fillColor: "white",
      opacity: gNaxBoxZoomFadeOpacity,
    });
    gTier1NavGroup.addChild(fillUnderNavBox);
  };

  const drawTier2 = () => {
    var secondsOnTier2 = gTier2SecondsPerPixel * gNavigatorWidth;

    gTier2Group.removeChildren();

    // draw tier2 boarder
    var tier2Top = gTier1Height + 5;
    var tierBottom = gTier2Height;
    var tierRect = new paper.Rectangle(
      1.5,
      tier2Top,
      gNavigatorWidth,
      gTier2Height
    );
    var cornerSize = new paper.Size(3, 3);
    var tierRectPath = paper.Path.RoundRectangle(tierRect, cornerSize);

    tierRectPath.strokeColor = tierBoxColor;
    gTier2Group.addChild(tierRectPath);
    // gTier2BoarderGroup.sendToBack();

    // draw video segments boxes
    for (var i = 0; i < videoItems.length; i++) {
      //draw if video segment start is before end of viewport, and video segment end is after start of viewport
      if (
        videoItems[i].missionSecondsStart <=
          gTier2StartSeconds + secondsOnTier2 &&
        videoItems[i].missionSecondsEnd >= gTier2StartSeconds
      ) {
        var startLocX =
          gTier2Left +
          (videoItems[i].missionSecondsStart - gTier2StartSeconds) *
            gTier2PixelsPerSecond;
        var endLocX =
          gTier2Left +
          (videoItems[i].missionSecondsEnd - gTier2StartSeconds) *
            gTier2PixelsPerSecond;

        var startLocY =
          gTier1Height +
          gTierSpacing +
          0.5 +
          videoItems[i]["group"] * (cChannelStrokeWidth + cVidBarGapWidth);
        var endLocY = startLocY + cChannelStrokeWidth + 1;

        var name = "vidItem_" + i.toString();

        var vidLine = new paper.Path.Rectangle({
          from: [startLocX, startLocY],
          to: [endLocX, endLocY],
          strokeWidth: 1,
          strokeColor: "black",
          fillColor: gColorVideo,
          name: name,
        });
        if (videoItems[i].className === "downlink-LOS")
          vidLine.fillColor = gColorVideoLOS;
        gTier2Group.addChild(vidLine);
      }
    }

    //display time ticks
    for (
      i = Math.round(gTier2StartSeconds);
      i < gTier2StartSeconds + secondsOnTier2;
      i++
    ) {
      if (
        parseInt(secondsToTimeStr(i).substring(3, 5)) % (10 * 60) === 0 &&
        secondsToTimeStr(i).substring(6, 8) === "00"
      ) {
        var itemSecondsFromLeft = i - gTier2StartSeconds;

        var itemLocX = gTier2Left + itemSecondsFromLeft * gTier2PixelsPerSecond;
        var barHeight = 10;
        var topPoint = new paper.Point(itemLocX, gTier2Top);
        var bottomPoint = new paper.Point(itemLocX, gTier2Top + barHeight);
        var aLine = new paper.Path.Line(topPoint, bottomPoint);
        aLine.strokeColor = gColorTimeTicks;
        gTier2Group.addChild(aLine);
      }
    }

    drawTier2EVActivity(0, activityPerformance.EV1, secondsOnTier2); // row 8 for EV1 (rows start at 0)
    drawTier2EVActivity(1, activityPerformance.EV2, secondsOnTier2); // row 9 for EV2 (rows start at 0)
    // drawTier2EVActivity(2, activityPerformance.DayNight, secondsOnTier2); // row 10 for day night  //TODO: disabled pending access to this data for all EVAs
  };

  const drawTier2EVActivity = (evRow, evActivityArray, secondsOnTier2) => {
    var tier2EVActivityHeight = 20;
    for (var i = 0; i < evActivityArray.length; i++) {
      if (
        evActivityArray[i].startTimeSeconds <=
          gTier2StartSeconds + secondsOnTier2 &&
        evActivityArray[i].endTimeSeconds >= gTier2StartSeconds
      ) {
        var startLocX =
          gTier2Left +
          (evActivityArray[i].startTimeSeconds - gTier2StartSeconds) *
            gTier2PixelsPerSecond;
        var endLocX =
          gTier2Left +
          (evActivityArray[i].endTimeSeconds - gTier2StartSeconds) *
            gTier2PixelsPerSecond;

        var startY =
          gTier1Height +
          gTierSpacing +
          0.5 +
          7 * (cChannelStrokeWidth + cVidBarGapWidth); //there are 7 video channels, start EV activity tracking below them
        var startLocY = startY + evRow * tier2EVActivityHeight;
        var endLocY = startLocY + tier2EVActivityHeight;

        var activityLine = new paper.Path.Rectangle({
          from: [startLocX, startLocY],
          to: [endLocX, endLocY],
          strokeWidth: 0.5,
          strokeColor: "black",
          // fillColor: gActivityBackgroundColor,
          fillColor: evActivityArray[i].color,
          name: name,
        });
        if (evActivityArray[i].content === "Insolation") {
          activityLine.fillColor = gDayColor;
        } else if (evActivityArray[i].content === "Eclipse") {
          activityLine.fillColor = gNightColor;
        }
        gTier2Group.addChild(activityLine);

        var activityText = new paper.PointText({
          justification: "left",
          fontFamily: gNavigatorFontFamily,
          //fontWeight: 'bold',
          fontSize: 13,
          fillColor: "white",
        });
        var textTop = startLocY + 14;
        activityText.point = new paper.Point(startLocX + 2, textTop);
        activityText.content = evActivityArray[i].content;
        if (
          evActivityArray[i].content === "Insolation" ||
          evActivityArray[i].color === "yellow"
        ) {
          activityText.fillColor = new paper.Color("#000000");
        }
        gTier2Group.addChild(activityText);
      }
    }
  };

  const drawCursor = (seconds) => {
    gCursorGroup.removeChildren();
    gCursorGroup.addChild(getCursorElement(seconds, gColorCursor));
  };

  const drawNavCursor = (seconds) => {
    gNavCursorGroup.removeChildren();
    gNavCursorGroup.addChild(getCursorElement(seconds, gColorNavCursor));
  };

  const getCursorElement = (seconds, color) => {
    var cursorElementGroup = new paper.Group();

    // tier1
    var cursorLocX = 0.5 + seconds * gTier1PixelsPerSecond;
    var topPoint = new paper.Point(cursorLocX, 1);
    var bottomPoint = new paper.Point(cursorLocX, gTier1Height);
    var aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = gColorNavCursor;
    cursorElementGroup.addChild(aLine);

    // tier2
    var tierBottom = gNavigatorHeight;
    cursorLocX =
      gTier2Left + (seconds - gTier2StartSeconds) * gTier2PixelsPerSecond;
    topPoint = new paper.Point(cursorLocX, gTier2Top);
    bottomPoint = new paper.Point(cursorLocX, tierBottom);
    aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = color;
    cursorElementGroup.addChild(aLine);

    var timeText = new paper.PointText({
      justification: "left",
      fontWeight: "bold",
      fontFamily: gNavigatorFontFamily,
      fontSize: 13,
      fillColor: color,
    });
    timeText.content = secondsToZuluString(seconds, timingData);
    timeText.point = new paper.Point(
      cursorLocX - timeText.bounds.width / 2,
      tierBottom - 6
    );
    if (timeText.point.x < 5) {
      timeText.point.x = 5;
    } else if (timeText.point.x > gNavigatorWidth - timeText.bounds.width - 5) {
      timeText.point.x = gNavigatorWidth - timeText.bounds.width - 5;
    }
    var cornerSize = new paper.Size(3, 3);
    var timeTextRect = new paper.Path.RoundRectangle(
      timeText.bounds,
      cornerSize
    );
    //var timeTextRect = new paper.Path.Rectangle(timeText.bounds);
    timeTextRect.strokeColor = color;
    timeTextRect.fillColor = "black";
    //timeTextRect.opacity = 0.5;
    timeTextRect.scale(1.1, 1.2);
    cursorElementGroup.addChild(timeTextRect);
    cursorElementGroup.addChild(timeText);

    return cursorElementGroup;
  };

  const setDynamicWidthVariables = () => {
    gNavigatorWidth = paper.view.size.width - 5;
    gNavigatorHeight = paper.view.size.height;
    gTier1Height = 51;
    gTier2Height = 100;

    gTier1PixelsPerSecond =
      gNavigatorWidth / timingData["EVA_duration_seconds"];
    gTier1SecondsPerPixel =
      timingData["EVA_duration_seconds"] / gNavigatorWidth;
    gTier2PixelsPerSecond =
      gNavigatorWidth / (timingData["EVA_duration_seconds"] / gNavZoomFactor);
    gTier2SecondsPerPixel =
      timingData["EVA_duration_seconds"] / gNavZoomFactor / gNavigatorWidth;

    gNavigatorWidth = paper.view.size.width;
    gNavigatorHeight = paper.view.size.height;

    gTierSpacing = 5;

    gTier1Top = 1;
    gTier2Top = gTier1Height + gTierSpacing;

    gTier1Left = 1;
    gTier2Left = 1;
  };

  const canvasID = "__NAV_CANVAS__";
  paper.setup(canvasID);
  paper.view.onResize = function () {
    setDynamicWidthVariables();
    drawTier1();
    drawTier1NavBox(missionTime);
    drawTier2();
    drawCursor(missionTime);
  };

  setDynamicWidthVariables();

  if (typeof gTier1Group !== "undefined") {
    gTier1Group.removeChildren();
    gTier1NavGroup.removeChildren();
    gTier2Group.removeChildren();
    gCursorGroup.removeChildren();
    gNavCursorGroup.removeChildren();
  } else {
    gTier1Group = new paper.Group();
    gTier1NavGroup = new paper.Group();
    gTier2Group = new paper.Group();
    gCursorGroup = new paper.Group();
    gNavCursorGroup = new paper.Group();
  }

  paper.view.onMouseMove = function (event) {
    gMouseOnNavigator = true;

    var mouseXSeconds;
    gNavCursorGroup.removeChildren();
    if (event.point.y < gTier1Top + gTier1Height + gTierSpacing) {
      //if in tier1
      mouseXSeconds = (event.point.x - 1) * gTier1SecondsPerPixel + 1;
      drawTier1NavBox(mouseXSeconds);
      drawTier2();
    } else {
      //if in tier 2
      mouseXSeconds =
        (event.point.x - gTier2Left) * gTier2SecondsPerPixel +
        gTier2StartSeconds;
    }
    // drawCursor(timeStrToSeconds(gCurrMissionTime));
    drawNavCursor(mouseXSeconds);
  };

  paper.view.onMouseUp = (event) => {
    if (event.point.y < gTier1Top + gTier1Height + gTierSpacing) {
      gCurrMissionTimeSeconds = Math.round(
        (event.point.x - 1) * gTier1SecondsPerPixel + 1
      );
      // var group = Math.trunc(event.point.y / (cChannelStrokeWidth + cVidBarGapWidth));
      // if (group <= 6)
      //     gCurrentGroup = group;
    } else {
      //if in tier 2
      gCurrMissionTimeSeconds = Math.round(
        (event.point.x - gTier2Left) * gTier2SecondsPerPixel +
          gTier2StartSeconds
      );
      // group = Math.trunc((event.point.y - (gTier1Height + 5)) / (cChannelStrokeWidth + cVidBarGapWidth));
      // if (group <= 6)
      //     gCurrentGroup = group;
    }
    // loadVideo(0, gSelectedVidGroup[0], gCurrMissionTimeSeconds);
    // loadVideo(1, gSelectedVidGroup[1], gCurrMissionTimeSeconds);
    // dispatch({ type: "update_video", payload: { videoID: 1, playerID: 1 } });
    drawCursor(gCurrMissionTimeSeconds);
  };

  const onMouseOutHandler = (_event) => {
    //trace("onMouseOutHandler()");
    gMouseOnNavigator = false;

    // $('#navigatorKey').css('display', '');
    // if (typeof gNavCursorGroup != "undefined") {
    gNavCursorGroup.removeChildren();
    // }
    drawTier1();
    drawTier1NavBox(gCurrMissionTimeSeconds);
    drawTier2();
  };

  paper.view.onMouseLeave = onMouseOutHandler;

  drawTier1();
  drawTier1NavBox(gCurrMissionTimeSeconds);
  drawTier2();

  // if (gmt) {
  //   // TODO convert gmt to seconds
  //   drawCursor(gmt);
  // }

  // the inline style here seems to be a problem because the styles rendered on the server are different than how the client interprets it. doesn't seem to be a big deal
  // https://github.com/vercel/next.js/issues/7322
  return <canvas id={canvasID} style={{ height: "175px", width: "100%" }} />;
}

export default NavTimeline;
