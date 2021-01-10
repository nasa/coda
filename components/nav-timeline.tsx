import { useRouter } from "next/router";
import paper from "paper";
import { useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { Activity } from "services/iss-wiki";
import { ClockState, getMissionTime, set } from "store/clock";
import { EVAsState, selectEVAStartMilliseconds } from "store/evas";
import { selectVideoFiles, selectVideoTimingData, VideosState } from "store/videos";
import { secondsToTimeStr, secondsToZuluString } from "utils/formatting";
import useInterval from "utils/useInterval";

let missionTime = null;

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
  const activityStartUTCMilliseconds = selectEVAStartMilliseconds(evas);
  const activityPerformance = evas.EVAs[evas.selectedEVA].activityPerformance;
  const dayNight = evas.EVAs[evas.selectedEVA].dayNight;

  const [mouseOnNavigator, setMouseOnNavigator] = useState(false);
  useInterval(() => {
    if (!mouseOnNavigator) {
      const { clock } = store.getState();
      const newMissionTime = getMissionTime(clock);
      if (newMissionTime !== missionTime) {
        drawTier1NavBox(newMissionTime);
        drawTier2();
        drawCursor(newMissionTime);
        missionTime = newMissionTime;
      }
    }
  }, 50);

  // get activity times in the mission timeframe
  let thisStartTimeSeconds =
    (activityStartUTCMilliseconds - timingData.video_earliestStart.getTime()) / 1000;
  for (let a = 0; a < activityPerformance.EV1.length; a++) {
    const activity = activityPerformance.EV1[a];
    activityPerformance.EV1[a].startTimeSeconds = thisStartTimeSeconds;
    activityPerformance.EV1[a].endTimeSeconds = thisStartTimeSeconds + activity.duration;
    thisStartTimeSeconds = thisStartTimeSeconds + activity.duration;
  }
  thisStartTimeSeconds =
    (activityStartUTCMilliseconds - timingData.video_earliestStart.getTime()) / 1000;
  for (let a = 0; a < activityPerformance.EV2.length; a++) {
    const activity = activityPerformance.EV2[a];
    activityPerformance.EV2[a].startTimeSeconds = thisStartTimeSeconds;
    activityPerformance.EV2[a].endTimeSeconds = thisStartTimeSeconds + activity.duration;
    thisStartTimeSeconds = thisStartTimeSeconds + activity.duration;
  }
  //slightly different for dayNight object
  thisStartTimeSeconds = (dayNight.dataStartUTC - timingData.video_earliestStart.getTime()) / 1000;
  for (let e = 0; e < dayNight.events.length; e++) {
    const event = dayNight.events[e];
    event.startTimeSeconds = thisStartTimeSeconds;
    event.endTimeSeconds = thisStartTimeSeconds + event.duration * 60;
    thisStartTimeSeconds = thisStartTimeSeconds + event.duration * 60;
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

  let gColorCursor = new paper.Color("#ff0000");
  let gColorNavCursor = new paper.Color("#00ff00"); //'green';
  let gColorTimeTicks = new paper.Color("#7b7b7b");
  let gColorVideo = new paper.Color("#999999");
  let gColorVideoLOS = new paper.Color("#4e4e4e");
  let gColorVideoBorder = "#2a282e";
  let tierBoxColor = new paper.Color("#999999");
  let gColorZoomPane1Border = new paper.Color("#5E92A6");
  let gColorZoomPane2Border = new paper.Color("#84b8d9");
  let gActivityBackgroundColor = new paper.Color("#eb272b");
  let gAlphaRectOpacity = 0.4;
  let gNaxBoxZoomFadeOpacity = 0.2;

  let gNavigatorFontFamily = "Roboto Mono";
  let gNavigatorFontFamilyActivity = "Inter";
  // let gNavigatorFontFamily = "Inter";
  // let gNavigatorFontFamily = "Space Mono";

  let cChannelStrokeWidth = 4;
  let cVidBarGapWidth = 1;

  const drawTier1 = () => {
    gTier1Group.removeChildren();
    let tierRect = new paper.Rectangle(gTier1Left, gTier1Top, gNavigatorWidth, gTier1Height);
    const cornerSize = new paper.Size(5, 5);
    // let tierRectPath = new paper.Path.Rectangle(tierRect, cornerSize);
    // tierRectPath.strokeColor = tierBoxColor;
    // gTier1Group.addChild(tierRectPath);

    //display time ticks
    for (let i = 0; i < timingData["EVA_duration_seconds"]; i++) {
      // sillily complex thing to show time ticks on the hour
      if (
        parseInt(secondsToTimeStr(i).substring(3, 5)) % (10 * 60) === 0 &&
        secondsToTimeStr(i).substring(6, 8) === "00"
      ) {
        let itemLocX = i * gTier1PixelsPerSecond;
        let topPoint = new paper.Point(itemLocX, gTier1Top);
        let bottomPoint = new paper.Point(itemLocX, gTier1Top + 10);
        let aLine = new paper.Path.Line(topPoint, bottomPoint);
        aLine.strokeColor = gColorTimeTicks;

        gTier1Group.addChild(aLine);
      }
    }

    //display video segments
    for (let i = 0; i < videoFiles.length; i++) {
      let startLocX = videoFiles[i].missionSecondsStart * gTier1PixelsPerSecond;
      let endLocX = videoFiles[i].missionSecondsEnd * gTier1PixelsPerSecond;

      let startLocY = gTier1Top + videoFiles[i]["group"] * (cChannelStrokeWidth + cVidBarGapWidth);
      let endLocY = startLocY + cChannelStrokeWidth + 1;

      const name = "vidItem_" + i.toString();

      let vidLine = new paper.Path.Rectangle({
        from: [startLocX, startLocY],
        to: [endLocX, endLocY],
        strokeWidth: 0.5,
        strokeColor: gColorVideoBorder,
        fillColor: gColorVideo,
        name,
      });
      if (videoFiles[i].className === "downlink-LOS") vidLine.fillColor = gColorVideoLOS;
      gTier1Group.addChild(vidLine);
    }

    //display EV activity

    drawTier1EVActivity(7, activityPerformance.EV1); // row 8 for EV1 (rows start at 0)
    drawTier1EVActivity(8, activityPerformance.EV2); // row 9 for EV2 (rows start at 0)
    drawTier1EVActivity(9, dayNight.events); // row 10 for day night  //TODO: pending access to this data for all EVAs. Wiki currently uncooperative.
  };

  const drawTier1EVActivity = (rowNum, evActivityArray: Activity[]) => {
    for (let i = 0; i < evActivityArray.length; i++) {
      let startLocX = evActivityArray[i].startTimeSeconds * gTier1PixelsPerSecond;
      let endLocX = evActivityArray[i].endTimeSeconds * gTier1PixelsPerSecond;
      let startLocY = gTier1Top + rowNum * (cChannelStrokeWidth + cVidBarGapWidth);
      let endLocY = startLocY + cChannelStrokeWidth + 1;
      let activityLine = new paper.Path.Rectangle({
        from: [startLocX, startLocY],
        to: [endLocX, endLocY],
        strokeWidth: 0.5,
        strokeColor: "black",
        // fillColor: gActivityBackgroundColor,
        fillColor: evActivityArray[i].color,
        // name: name,
      });
      gTier1Group.addChild(activityLine);
    }
  };

  const drawTier1NavBox = (seconds) => {
    gTier1NavGroup.removeChildren();

    let locX = seconds * gTier1PixelsPerSecond;
    let navBoxWidth = gNavigatorWidth / gNavZoomFactor;
    gTier1NavBoxLocX = locX - navBoxWidth / 2;
    if (gTier1NavBoxLocX < 0) {
      gTier1NavBoxLocX = 0;
    } else if (gTier1NavBoxLocX + navBoxWidth > gNavigatorWidth) {
      gTier1NavBoxLocX = gNavigatorWidth - navBoxWidth;
    }
    gTier2StartSeconds = gTier1SecondsPerPixel * gTier1NavBoxLocX;

    let navBoxRect = new paper.Rectangle(gTier1NavBoxLocX, gTier1Top, navBoxWidth, gTier1Height);
    const cornerSize = new paper.Size(2, 2);
    let navBoxRectPath = new paper.Path.Rectangle(navBoxRect, cornerSize);
    //var navBoxRectPath = paper.Path.Rectangle(navBoxRect);
    navBoxRectPath.strokeColor = new paper.Color("#ffc000");
    navBoxRectPath.strokeWidth = 4;
    gTier1NavGroup.addChild(navBoxRectPath);

    //navBoxEffect
    const startPoint = new paper.Point(gTier1NavBoxLocX - 2, gTier1Top + 3);
    const boxWidth = navBoxWidth + 4;
    const effectHeight = gTierSpacing + 1;
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
    gTier1NavGroup.addChild(navBoxEffect);

    //navBox effect orange bar full width
    const navBoxEffectBar = new paper.Path.Line({
      from: [0, gTier1Top - gTierSpacing],
      to: [gNavigatorWidth, gTier1Top - gTierSpacing],
      strokeColor: "#ffc000",
      strokeWidth: 4,
    });
    gTier1NavGroup.addChild(navBoxEffectBar);
  };

  const drawTier2 = () => {
    let secondsOnTier2 = gTier2SecondsPerPixel * gNavigatorWidth;

    gTier2Group.removeChildren();
    let tierBottom = gTier1Top + gTier2Height;

    // draw tier2 boarder
    // let tierRect = new paper.Rectangle(1.5, gTier2Top, gNavigatorWidth, gTier2Height);
    // let cornerSize = new paper.Size(3, 3);
    // let tierRectPath = new paper.Path.Rectangle(tierRect, cornerSize);
    // tierRectPath.strokeColor = tierBoxColor;
    // gTier2Group.addChild(tierRectPath);

    //draw tier2 video background staff lines
    let yPos = gTier2Top;
    for (let i = 0; i < 6; i++) {
      let staffLine = new paper.Path.Rectangle({
        from: [gTier2Left, yPos],
        to: [gNavigatorWidth, yPos + cChannelStrokeWidth + 1],
        strokeWidth: 1,
        strokeColor: gColorVideoBorder,
        // fillColor: "#3e3b44", //page body background color
      });
      yPos = yPos + cChannelStrokeWidth + cVidBarGapWidth;
      gTier2Group.addChild(staffLine);
    }
    //draw tier2 activity background staff lines
    const tier2EVActivityHeight = 20;
    let startY = gTier2Top + 7 * (cChannelStrokeWidth + cVidBarGapWidth);

    for (let i = 0; i < 3; i++) {
      let startLocY = startY + i * tier2EVActivityHeight;
      let endLocY = startLocY + tier2EVActivityHeight;
      let activityStaffLine = new paper.Path.Rectangle({
        from: [gTier2Left, startLocY],
        to: [gNavigatorWidth, endLocY],
        strokeWidth: 1,
        strokeColor: gColorVideoBorder,
        // fillColor: "#3e3b44", //page body background color
      });
      yPos = yPos + tier2EVActivityHeight;
      gTier2Group.addChild(activityStaffLine);
    }

    // draw video segments boxes
    for (let i = 0; i < videoFiles.length; i++) {
      //draw if video segment start is before end of viewport, and video segment end is after start of viewport
      if (
        videoFiles[i].missionSecondsStart <= gTier2StartSeconds + secondsOnTier2 &&
        videoFiles[i].missionSecondsEnd >= gTier2StartSeconds
      ) {
        let startLocX =
          gTier2Left +
          (videoFiles[i].missionSecondsStart - gTier2StartSeconds) * gTier2PixelsPerSecond;
        let endLocX =
          gTier2Left +
          (videoFiles[i].missionSecondsEnd - gTier2StartSeconds) * gTier2PixelsPerSecond;

        let startLocY =
          gTier2Top + videoFiles[i]["group"] * (cChannelStrokeWidth + cVidBarGapWidth);
        let endLocY = startLocY + cChannelStrokeWidth + 1;

        let name = "vidItem_" + i.toString();

        let vidLine = new paper.Path.Rectangle({
          from: [startLocX, startLocY],
          to: [endLocX, endLocY],
          strokeWidth: 1,
          strokeColor: gColorVideoBorder,
          fillColor: gColorVideo,
          name: name,
        });
        if (videoFiles[i].className === "downlink-LOS") vidLine.fillColor = gColorVideoLOS;
        gTier2Group.addChild(vidLine);
      }
    }

    //display time ticks
    for (let i = Math.round(gTier2StartSeconds); i < gTier2StartSeconds + secondsOnTier2; i++) {
      if (
        parseInt(secondsToTimeStr(i).substring(3, 5)) % (10 * 60) === 0 &&
        secondsToTimeStr(i).substring(6, 8) === "00"
      ) {
        let itemSecondsFromLeft = i - gTier2StartSeconds;

        let itemLocX = gTier2Left + itemSecondsFromLeft * gTier2PixelsPerSecond;
        let barHeight = 10;
        let topPoint = new paper.Point(itemLocX, gTier2Top);
        let bottomPoint = new paper.Point(itemLocX, gTier2Top + barHeight);
        let aLine = new paper.Path.Line(topPoint, bottomPoint);
        aLine.strokeColor = gColorTimeTicks;
        gTier2Group.addChild(aLine);
      }
    }

    drawTier2EVActivity(0, activityPerformance.EV1, secondsOnTier2); // row 8 for EV1 (rows start at 0)
    drawTier2EVActivity(1, activityPerformance.EV2, secondsOnTier2); // row 9 for EV2 (rows start at 0)
    drawTier2EVActivity(2, dayNight.events, secondsOnTier2); // row 10 for day night  //TODO: disabled pending access to this data for all EVAs
  };

  const drawTier2EVActivity = (evRow, evActivityArray, secondsOnTier2) => {
    const tier2EVActivityHeight = 20;
    for (let i = 0; i < evActivityArray.length; i++) {
      if (
        evActivityArray[i].startTimeSeconds <= gTier2StartSeconds + secondsOnTier2 &&
        evActivityArray[i].endTimeSeconds >= gTier2StartSeconds
      ) {
        let startLocX =
          gTier2Left +
          (evActivityArray[i].startTimeSeconds - gTier2StartSeconds) * gTier2PixelsPerSecond;
        let endLocX =
          gTier2Left +
          (evActivityArray[i].endTimeSeconds - gTier2StartSeconds) * gTier2PixelsPerSecond;

        let startY = gTier2Top + 7 * (cChannelStrokeWidth + cVidBarGapWidth); //there are 7 video channels, start EV activity tracking below them
        let startLocY = startY + evRow * tier2EVActivityHeight;
        let endLocY = startLocY + tier2EVActivityHeight;

        let activityLine = new paper.Path.Rectangle({
          from: [startLocX, startLocY],
          to: [endLocX, endLocY],
          strokeWidth: 0.5,
          strokeColor: gColorVideoBorder,
          // fillColor: gActivityBackgroundColor,
          fillColor: evActivityArray[i].color,
          name: name,
        });
        gTier2Group.addChild(activityLine);

        let activityText = new paper.PointText({
          justification: "left",
          fontFamily: gNavigatorFontFamilyActivity,
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
    gNavCursorGroup.addChild(getCursorElement(seconds, gColorCursor));
  };

  const getCursorElement = (seconds, color) => {
    let cursorElementGroup = new paper.Group();

    // tier1
    let cursorLocX = 0.5 + seconds * gTier1PixelsPerSecond;
    let topPoint = new paper.Point(cursorLocX, gTier1Top + 3);
    let bottomPoint = new paper.Point(cursorLocX, gTier1Top + gTier1Height - 2);
    let aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = color;
    aLine.strokeWidth = 2;
    cursorElementGroup.addChild(aLine);

    // tier2
    cursorLocX = gTier2Left + (seconds - gTier2StartSeconds) * gTier2PixelsPerSecond;
    topPoint = new paper.Point(cursorLocX, gTier2Top - 2);
    bottomPoint = new paper.Point(cursorLocX, gTier2Top - 2 + gTier2Height);
    aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = color;
    aLine.strokeWidth = 2;
    cursorElementGroup.addChild(aLine);

    let timeText = new paper.PointText({
      justification: "left",
      fontWeight: "bold",
      fontFamily: gNavigatorFontFamily,
      fontSize: 20,
      fillColor: "white",
    });
    timeText.content = " " + secondsToZuluString(seconds, timingData) + " ";
    timeText.point = new paper.Point(cursorLocX - timeText.bounds.width / 2, 20);
    const cornerSize = new paper.Size(12, 12);
    let timeTextRect = new paper.Rectangle(timeText.bounds);
    //center rectangle behind text
    timeTextRect.width = 135;
    timeTextRect.height += 5;
    timeTextRect.top -= 2;
    if (timeText.point.x < 5) {
      timeText.point.x = 5;
    } else if (timeText.point.x > gNavigatorWidth - timeTextRect.width - 5) {
      timeText.point.x = gNavigatorWidth - timeTextRect.width - 5;
    }
    timeTextRect.left = timeText.point.x;
    timeTextRect.left -= 5;
    let timeTextRectPath = new paper.Path.Rectangle(timeTextRect, cornerSize);
    //var timeTextRect = new paper.Path.Rectangle(timeText.bounds);
    // timeTextRect.strokeColor = color;
    // timeTextRect.strokeWidth = 5;
    timeTextRectPath.fillColor = new paper.Color("red");
    timeTextRectPath.opacity = 0.8;
    //timeTextRect.opacity = 0.5;
    // timeTextRectPath.scale(1.1, 1.8);
    cursorElementGroup.addChild(timeTextRectPath);
    cursorElementGroup.addChild(timeText);

    return cursorElementGroup;
  };

  const setDynamicWidthVariables = () => {
    gNavigatorWidth = paper.view.size.width;
    gNavigatorHeight = paper.view.size.height;

    gTier1PixelsPerSecond = gNavigatorWidth / timingData["EVA_duration_seconds"];
    gTier1SecondsPerPixel = timingData["EVA_duration_seconds"] / gNavigatorWidth;
    gTier2PixelsPerSecond = gNavigatorWidth / (timingData["EVA_duration_seconds"] / gNavZoomFactor);
    gTier2SecondsPerPixel = timingData["EVA_duration_seconds"] / gNavZoomFactor / gNavigatorWidth;

    gTier1Height = 50;
    gTier2Height = 99;

    gTierSpacing = 30;

    gTier2Top = 30;
    gTier1Top = gTier2Top + gTier2Height + gTierSpacing;

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
    if (!mouseOnNavigator) {
      setMouseOnNavigator(true);
    }

    let mouseXSeconds;
    gNavCursorGroup.removeChildren();
    if (event.point.y > gTier1Top) {
      //if in tier1
      mouseXSeconds = (event.point.x - 1) * gTier1SecondsPerPixel + 1;
      drawTier1NavBox(mouseXSeconds);
      drawTier2();
    } else {
      //if in tier 2
      mouseXSeconds = (event.point.x - gTier2Left) * gTier2SecondsPerPixel + gTier2StartSeconds;
    }
    drawNavCursor(mouseXSeconds);
  };

  paper.view.onMouseUp = (event) => {
    let seconds = 0;
    if (event.point.y > gTier1Top) {
      seconds = Math.round((event.point.x - 1) * gTier1SecondsPerPixel + 1);
    } else {
      //if in tier 2
      seconds = Math.round(
        (event.point.x - gTier2Left) * gTier2SecondsPerPixel + gTier2StartSeconds
      );
    }

    const hh = Math.floor(seconds / 3600);
    const mm = Math.floor((seconds - hh * 3600) / 60);
    const ss = seconds - hh * 3600 - mm * 60;
    const [Y, M, D] = evas.EVAs[evas.selectedEVA].startDate.split("/");
    const dt = new Date(+Y, +M - 1, +D, hh, mm, ss);
    dispatch(set(dt.toISOString()));
    drawCursor(seconds);
  };

  const onMouseOutHandler = (_event) => {
    setMouseOnNavigator(false);
    gNavCursorGroup.removeChildren();
  };

  paper.view.onMouseLeave = onMouseOutHandler;

  drawTier1();
  drawTier1NavBox(missionTime);
  drawTier2();

  // the inline style here seems to be a problem because the styles rendered on the server are different than how the client interprets it. doesn't seem to be a big deal
  // https://github.com/vercel/next.js/issues/7322
  return (
    <canvas
      id={canvasID}
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
