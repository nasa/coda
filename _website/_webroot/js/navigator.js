var gTier1Group;
var gTier1NavGroup;
var gTier1NavBoxLocX;

var gTier2Group;
var gTier2BoarderGroup;
var gTier2StartSeconds;

var gCursorGroup;
var gNavCursorGroup;

var gNavigatorWidth;
var gNavigatorHeight;

var gNavZoomFactor = 25;
var gTier1Height;
var gTier2Height;
var gTier1PixelsPerSecond;
var gTier1SecondsPerPixel;
var gTier2PixelsPerSecond;
var gTier2SecondsPerPixel;

var gTierSpacing;
var gTier1Top;
var gTier2Top;
var gTier1Left;
var gTier2Left;

var gColorCursor = '#00ff00';
var gColorNavCursor = '#ffff00'; //'yellow';
var gColorTimeTicks = '#7b7b7b';
var gColorVideo = "#999999";
var gColorVideoLOS = "#4e4e4e";
var tierBoxColor = '#999999';
var gColorZoomPane1Border = '#5E92A6';
var gColorZoomPane2Border = '#84b8d9';
var gActivityBackgroundColor = '#eb272b';
var gAlphaRectOpacity = 0.4;
var gNaxBoxZoomFadeOpacity = 0.2;

var gNavigatorFontFamily = 'Roboto Mono';

var cChannelStrokeWidth = 4;
var cVidBarGapWidth = 1;

var gMouseOnNavigator;

function initNavigator() {
    // $("body").css("overflow", "hidden");
    paper.install(window);
    paper.setup('navCanvas');

    paper.view.onResize = function() {
        setDynamicWidthVariables();
        drawTier1();
        drawTier1NavBox(gCurrMissionTimeSeconds);
        drawTier2();
        drawCursor(gCurrMissionTimeSeconds);
    };

    setDynamicWidthVariables();

    gTier1Group = new paper.Group;
    gTier1NavGroup = new paper.Group;
    gTier2Group = new paper.Group;
    gCursorGroup = new paper.Group;
    gNavCursorGroup = new paper.Group;

    paper.view.onMouseMove = function (event) {
        gMouseOnNavigator = true;

        var mouseXSeconds;
        gNavCursorGroup.removeChildren();
        if (event.point.y < gTier1Top + gTier1Height + gTierSpacing) { //if in tier1
            mouseXSeconds = (event.point.x - 1) * gTier1SecondsPerPixel + 1;
            drawTier1NavBox(mouseXSeconds);
            drawTier2(true);
        } else { //if in tier 2
            mouseXSeconds = (event.point.x - gTier2Left) * gTier2SecondsPerPixel + gTier2StartSeconds;
        }
        // drawCursor(timeStrToSeconds(gCurrMissionTime));
        drawNavCursor(mouseXSeconds);
    };

    paper.view.onMouseUp = function (event) {
        if (event.point.y < gTier1Top + gTier1Height + gTierSpacing) {
            gCurrMissionTimeSeconds = parseInt((event.point.x - 1) * gTier1SecondsPerPixel + 1);
            // var group = Math.trunc(event.point.y / (cChannelStrokeWidth + cVidBarGapWidth));
            // if (group <= 6)
            //     gCurrentGroup = group;
        } else { //if in tier 2
            gCurrMissionTimeSeconds = parseInt((event.point.x - gTier2Left) * gTier2SecondsPerPixel + gTier2StartSeconds);
            // group = Math.trunc((event.point.y - (gTier1Height + 5)) / (cChannelStrokeWidth + cVidBarGapWidth));
            // if (group <= 6)
            //     gCurrentGroup = group;
        }
        loadVideo(0, gSelectedVidGroup[0], gCurrMissionTimeSeconds);
        loadVideo(1, gSelectedVidGroup[1], gCurrMissionTimeSeconds);
        drawCursor(gCurrMissionTimeSeconds);
    };

    paper.view.onMouseLeave = function(event) {
        // trace("paper.view.onMouseLeave triggered");
        onMouseOutHandler();
    };

    drawTier1();
    drawTier1NavBox(gCurrMissionTimeSeconds);
    drawTier2();
}

function drawTier1() {
    gTier1Group.removeChildren();
    var tierRect = new paper.Rectangle(gTier1Left, gTier1Top, gNavigatorWidth, gTier1Height);
    var cornerSize = new paper.Size(5, 5);
    var tierRectPath = paper.Path.RoundRectangle(tierRect, cornerSize);
    //var tierRectPath = paper.Path.Rectangle(tierRect);
    tierRectPath.strokeColor = tierBoxColor;
    gTier1Group.addChild(tierRectPath);

    //display time ticks
    for (var i = 0; i < gTimingData['EVA_duration_seconds']; i++) {
        // sillily complex thing to show time ticks on the hour
        if (parseInt(secondsToTimeStr(i).substring(3,5)) % (10 * 60) === 0 && secondsToTimeStr(i).substring(6,8) === '00') {
            var itemLocX = i * gTier1PixelsPerSecond;
            var topPoint = new paper.Point(itemLocX, 1);
            var bottomPoint = new paper.Point(itemLocX, 10);
            var aLine = new paper.Path.Line(topPoint, bottomPoint);
            aLine.strokeColor = gColorTimeTicks;

            gTier1Group.addChild(aLine);
        }
    }

    //display video segments
    for (i = 0; i < gVideoItems.length; i++) {
        var startLocX = gVideoItems[i]['missionSecondsStart'] * gTier1PixelsPerSecond;
        var endLocX = gVideoItems[i]['missionSecondsEnd'] * gTier1PixelsPerSecond;

        var startLocY = 0.5 + (gVideoItems[i]['group'] * (cChannelStrokeWidth + cVidBarGapWidth));
        var endLocY = startLocY + cChannelStrokeWidth + 1;

        var name = "vidItem_" + i.toString();

        var vidLine = new paper.Path.Rectangle({
            from: [startLocX, startLocY],
            to: [endLocX, endLocY],
            strokeWidth: 0.5,
            strokeColor: 'black',
            fillColor: gColorVideo,
            name: name
        });
        if (gVideoItems[i].className === 'downlink-LOS')
            vidLine.fillColor = gColorVideoLOS;
        gTier1Group.addChild(vidLine);
    }

    //display EV1 activity
    if (gEVADate === '2019-08-21') { //TODO total hack
        drawTier1EVActivity(7, gVideoActivity.EV1); // row 8 for EV1 (rows start at 0)
        drawTier1EVActivity(8, gVideoActivity.EV2); // row 9 for EV2 (rows start at 0)
    }
}

function drawTier1EVActivity(rowNum, evActivityArray) {
    for (var i = 0; i < evActivityArray.length; i++) {
        var startLocX = evActivityArray[i].startTimeSeconds * gTier1PixelsPerSecond;
        var endLocX = evActivityArray[i].endTimeSeconds * gTier1PixelsPerSecond;
        var startLocY = 0.5 + (rowNum * (cChannelStrokeWidth + cVidBarGapWidth));
        var endLocY = startLocY + cChannelStrokeWidth + 1;
        var activityLine = new paper.Path.Rectangle({
            from: [startLocX, startLocY],
            to: [endLocX, endLocY],
            strokeWidth: 0.5,
            strokeColor: 'black',
            fillColor: gActivityBackgroundColor,
            name: name
        });
        gTier1Group.addChild(activityLine);
    }
}

function drawTier1NavBox(seconds) {
    gTier1NavGroup.removeChildren();

    var locX = seconds * gTier1PixelsPerSecond;
    var navBoxWidth = gNavigatorWidth / gNavZoomFactor;
    gTier1NavBoxLocX = locX - (navBoxWidth / 2);
    if (gTier1NavBoxLocX < 0) {
        gTier1NavBoxLocX = 0;
    } else if (gTier1NavBoxLocX + navBoxWidth > gNavigatorWidth) {
        gTier1NavBoxLocX = gNavigatorWidth - navBoxWidth;
    }
    gTier2StartSeconds = (gTier1SecondsPerPixel * gTier1NavBoxLocX);

    var navBoxRect = new paper.Rectangle(gTier1NavBoxLocX, 1.5, navBoxWidth, gTier1Height);
    var cornerSize = new paper.Size(2, 2);
    var navBoxRectPath = paper.Path.RoundRectangle(navBoxRect, cornerSize);
    //var navBoxRectPath = paper.Path.Rectangle(navBoxRect);
    navBoxRectPath.strokeColor = gColorZoomPane1Border;
    gTier1NavGroup.addChild(navBoxRectPath);

    var leftAlphaRect = new paper.Rectangle(gTier1Left, gTier1Top, gTier1NavBoxLocX - gTier1Left, gTier1Height);
    var leftAlphaRectPath = paper.Path.RoundRectangle(leftAlphaRect, cornerSize);
    leftAlphaRectPath.fillColor = new paper.Color(0,0,0, gAlphaRectOpacity);
    gTier1NavGroup.addChild(leftAlphaRectPath);

    var rightAlphaRect = new paper.Rectangle(gTier1NavBoxLocX + navBoxWidth, gTier1Top, gNavigatorWidth - gTier1NavBoxLocX + navBoxWidth , gTier1Height);
    var rightAlphaRectPath = paper.Path.RoundRectangle(rightAlphaRect, cornerSize);
    rightAlphaRectPath.fillColor = new paper.Color(0,0,0, gAlphaRectOpacity);
    gTier1NavGroup.addChild(rightAlphaRectPath);


    //add zoom curves
    var leftCurveObj = new paper.Path({
        segments:
            [
                [gTier1NavBoxLocX, (gTier1Top + gTier1Height/2)],
                [gTier2Left, gTier2Top],
                [gTier1NavBoxLocX, gTier2Top]
            ],

        strokeColor: 'white',
        // closed: true,
        strokeWidth: 1,
        strokeJoin: 'round',
        fillColor: 'white',
        opacity: gNaxBoxZoomFadeOpacity
    });
    var handleVector = new paper.Point({
        angle: 90,
        length: gTier1Height
    });
    leftCurveObj.segments[0].handleOut = handleVector;
    gTier1NavGroup.addChild(leftCurveObj);

    var rightCurveObj = new paper.Path({
        segments:
            [
                [gTier1NavBoxLocX + navBoxWidth, (gTier1Top + gTier1Height/2)],
                [gNavigatorWidth, gTier2Top],
                [gTier1NavBoxLocX + navBoxWidth, gTier2Top]
            ],

        strokeColor: 'white',
        // closed: true,
        strokeWidth: 1,
        strokeJoin: 'round',
        fillColor: 'white',
        opacity: gNaxBoxZoomFadeOpacity
    });
    rightCurveObj.segments[0].handleOut = handleVector;
    gTier1NavGroup.addChild(rightCurveObj);

    var fillUnderNavBox = new paper.Path({
        segments:
            [
                [gTier1NavBoxLocX + 0.5, (gTier1Top + gTier1Height)],
                [gTier1NavBoxLocX + 0.5, gTier2Top],
                [gTier1NavBoxLocX + navBoxWidth - 0.5, gTier2Top],
                [gTier1NavBoxLocX + navBoxWidth - 0.5, (gTier1Top + gTier1Height)]
            ],
        strokeColor: 'white',
        closed: true,
        strokeWidth: 1,
        // strokeJoin: 'round',
        fillColor: 'white',
        opacity: gNaxBoxZoomFadeOpacity
    });
    gTier1NavGroup.addChild(fillUnderNavBox);

}

function drawTier2() {
    var secondsOnTier2 = gTier2SecondsPerPixel * gNavigatorWidth;

    gTier2Group.removeChildren();

    // draw tier2 boarder
    var tier2Top = gTier1Height + 5;
    var tierBottom = gTier2Height;
    var tierRect = new paper.Rectangle(1.5, tier2Top, gNavigatorWidth, gTier2Height);
    var cornerSize = new paper.Size(3, 3);
    var tierRectPath = paper.Path.RoundRectangle(tierRect, cornerSize);

    tierRectPath.strokeColor = tierBoxColor;
    gTier2Group.addChild(tierRectPath);
    // gTier2BoarderGroup.sendToBack();

    // draw video segments boxes
    for (var i = 0; i < gVideoItems.length; i++) {
        //draw if video segment start is before end of viewport, and video segment end is after start of viewport
        if (gVideoItems[i].missionSecondsStart <= gTier2StartSeconds + secondsOnTier2 && gVideoItems[i].missionSecondsEnd >= gTier2StartSeconds) {
            var startLocX = gTier2Left + (gVideoItems[i].missionSecondsStart - gTier2StartSeconds) * gTier2PixelsPerSecond;
            var endLocX = gTier2Left + (gVideoItems[i].missionSecondsEnd - gTier2StartSeconds) * gTier2PixelsPerSecond;

            var startLocY = gTier1Height + gTierSpacing + 0.5 + (gVideoItems[i]['group'] * (cChannelStrokeWidth + cVidBarGapWidth));
            var endLocY = startLocY + cChannelStrokeWidth + 1;

            var name = "vidItem_" + i.toString();

            var vidLine = new paper.Path.Rectangle({
                from: [startLocX, startLocY],
                to: [endLocX, endLocY],
                strokeWidth: 1,
                strokeColor: 'black',
                fillColor: gColorVideo,
                name: name
            });
            if (gVideoItems[i].className === 'downlink-LOS')
                vidLine.fillColor = gColorVideoLOS;
            gTier2Group.addChild(vidLine);
        }
    }

    //display time ticks
    for (i = Math.round(gTier2StartSeconds); i < gTier2StartSeconds + secondsOnTier2; i++) {
        if (parseInt(secondsToTimeStr(i).substring(3,5)) % (10 * 60) === 0 && secondsToTimeStr(i).substring(6,8) === '00') {
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

    if (gEVADate === '2019-08-21') { //TODO total hack
        drawTier2EVActivity(0, gVideoActivity.EV1, secondsOnTier2); // row 8 for EV1 (rows start at 0)
        drawTier2EVActivity(1, gVideoActivity.EV2, secondsOnTier2); // row 9 for EV2 (rows start at 0)
    }
}

function drawTier2EVActivity(evRow, evActivityArray, secondsOnTier2) {
    var tier2EVActivityHeight = 20;
    for (var i = 0; i < evActivityArray.length; i++) {
        if (evActivityArray[i].startTimeSeconds <= gTier2StartSeconds + secondsOnTier2 && evActivityArray[i].endTimeSeconds >= gTier2StartSeconds) {
            var startLocX = gTier2Left + (evActivityArray[i].startTimeSeconds - gTier2StartSeconds) * gTier2PixelsPerSecond;
            var endLocX = gTier2Left + (evActivityArray[i].endTimeSeconds - gTier2StartSeconds) * gTier2PixelsPerSecond;

            var startY = gTier1Height + gTierSpacing + 0.5 + (7 * (cChannelStrokeWidth + cVidBarGapWidth)); //there are 7 video channels, start EV activity tracking below them
            var startLocY = startY + (evRow * tier2EVActivityHeight);
            var endLocY = startLocY + tier2EVActivityHeight;

            var activityLine = new paper.Path.Rectangle({
                from: [startLocX, startLocY],
                to: [endLocX, endLocY],
                strokeWidth: 0.5,
                strokeColor: 'black',
                fillColor: gActivityBackgroundColor,
                name: name
            });
            gTier2Group.addChild(activityLine);

            var activityText = new paper.PointText({
                justification: 'left',
                fontFamily: gNavigatorFontFamily,
                //fontWeight: 'bold',
                fontSize: 13,
                fillColor: 'white'
            });
            var textTop = startLocY + 14;
            activityText.point = new paper.Point(startLocX + 2, textTop);
            activityText.content = evActivityArray[i].content;
            gTier2Group.addChild(activityText);
        }
    }
}

function drawCursor(seconds) {
    gCursorGroup.removeChildren();
    gCursorGroup.addChild(getCursorElement(seconds, gColorCursor));
}

function drawNavCursor(seconds) {
    gNavCursorGroup.removeChildren();
    gNavCursorGroup.addChild(getCursorElement(seconds, gColorNavCursor));
}

function getCursorElement(seconds, color) {
    var cursorElementGroup = new paper.Group();

    // tier1
    var cursorLocX = 0.5 + (seconds * gTier1PixelsPerSecond);
    var topPoint = new paper.Point(cursorLocX, 1);
    var bottomPoint = new paper.Point(cursorLocX, gTier1Height);
    var aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = gColorNavCursor;
    cursorElementGroup.addChild(aLine);

    // tier2
    var tierBottom = gNavigatorHeight;
    cursorLocX = gTier2Left + ((seconds - gTier2StartSeconds) * gTier2PixelsPerSecond);
    topPoint = new paper.Point(cursorLocX, gTier2Top);
    bottomPoint = new paper.Point(cursorLocX, tierBottom);
    aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = color;
    cursorElementGroup.addChild(aLine);

    var timeText = new paper.PointText({
        justification: 'left',
        fontWeight: 'bold',
        fontFamily: gNavigatorFontFamily,
        fontSize: 13,
        fillColor: color
    });
    timeText.content = secondsToZuluString(seconds);
    timeText.point = new paper.Point(cursorLocX - timeText.bounds.width / 2 , tierBottom - 6);
    if (timeText.point.x < 5) {
        timeText.point.x = 5;
    } else if (timeText.point.x > gNavigatorWidth - timeText.bounds.width - 5) {
        timeText.point.x = gNavigatorWidth - timeText.bounds.width - 5;
    }
    var cornerSize = new paper.Size(3, 3);
    var timeTextRect = new paper.Path.RoundRectangle(timeText.bounds, cornerSize);
    //var timeTextRect = new paper.Path.Rectangle(timeText.bounds);
    timeTextRect.strokeColor = color;
    timeTextRect.fillColor = 'black';
    //timeTextRect.opacity = 0.5;
    timeTextRect.scale(1.1, 1.2);
    cursorElementGroup.addChild(timeTextRect);
    cursorElementGroup.addChild(timeText);

    return cursorElementGroup;
}

function onMouseOutHandler() {
    //trace("onMouseOutHandler()");
    gMouseOnNavigator = false;

    // $('#navigatorKey').css('display', '');
    // if (typeof gNavCursorGroup != "undefined") {
    gNavCursorGroup.removeChildren();
    // }
    drawTier1();
    drawTier1NavBox(gCurrMissionTimeSeconds);
    drawTier2();
}

function setDynamicWidthVariables() {
    gNavigatorWidth = paper.view.size.width - 5;
    gNavigatorHeight = paper.view.size.height;
    gTier1Height = 46;
    gTier2Height = 80;

    gTier1PixelsPerSecond = gNavigatorWidth / gTimingData['EVA_duration_seconds'] ;
    gTier1SecondsPerPixel = gTimingData['EVA_duration_seconds'] / gNavigatorWidth;
    gTier2PixelsPerSecond = gNavigatorWidth / (gTimingData['EVA_duration_seconds'] / gNavZoomFactor);
    gTier2SecondsPerPixel = (gTimingData['EVA_duration_seconds'] / gNavZoomFactor) / gNavigatorWidth;

    gNavigatorWidth = paper.view.size.width;
    gNavigatorHeight = paper.view.size.height;

    gTierSpacing = 5;

    gTier1Top = 1;
    gTier2Top = gTier1Height + gTierSpacing;

    gTier1Left = 1;
    gTier2Left = 1;
}