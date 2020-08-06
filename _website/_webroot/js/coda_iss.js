var gVideoItems = [];
var gTimingData = {};
var gVideoActivityByGroupBySecond = [];
var gSelectedVideoStartTimeSeconds = [];
var gGroupVideoStartTimeSeconds = [];
var gVideoActivity = {};
var gVideoPlaying = [false, false];

var gEVADate = '2019-08-21';  //default to US_EVA_55
var gEVAGMT = '12:49:57'; //default to US_EVA_55

var gAudioMetadata = [];
var gSelectedAudioChannel = -1;

var gCurrMissionTimeSeconds = 0;
var gLastMissionTimeSeconds = 0;
var gSelectedVidGroup = [0, 1];

var gInterval;


$(function() {
    //Handler for .ready() called.

    //get date parameter if exists
    if (typeof $.getUrlVar('date') !== "undefined") {
        gEVADate = $.getUrlVar('date');
        gEVADate = decodeURIComponent(gEVADate);
    }

    //remove audio components if not US_EVA_55. //todo Total hack
    if (gEVADate !== '2019-08-21') {
        document.getElementsByClassName('audioPanel')[0].style.display = 'none';
    }

    var dateArr = gEVADate.split('-');
    $.when(ajaxGetIoJSON(dateArr[0], dateArr[1], dateArr[2], [])).done(function () {
        $.when(ajaxGetEV1ActivityJSON(), ajaxGetEV2ActivityJSON(), ajaxGetAudioMetadataJSON()).done( function () {
            initCODA();
            initNavigator();
            setEventHandlers();
            startInterval();
        });
    });
});

function initCODA() {
    if (typeof $.getUrlVar('GMT') !== "undefined") {
        gEVAGMT = $.getUrlVar('GMT');
        gEVAGMT = decodeURIComponent(gEVAGMT);
    }

    var missionDateArr = gEVADate.split('-');
    var missionTimeArr = gEVAGMT.split(':');

    var UTCDateFromFields = Date.UTC(
        missionDateArr[0], missionDateArr[1] - 1, missionDateArr[2], missionTimeArr[0], missionTimeArr[1], missionTimeArr[2]
    );
    gCurrMissionTimeSeconds = (UTCDateFromFields - gTimingData['video_earliestStart']) / 1000;
    gLastMissionTimeSeconds = 0;
    loadVideo(0, gSelectedVidGroup[0], gCurrMissionTimeSeconds + 1);
    loadVideo(1, gSelectedVidGroup[1], gCurrMissionTimeSeconds + 1);
}

function startInterval() {
    clearInterval(gInterval);
    gInterval = setInterval(function() {

        if (gCurrMissionTimeSeconds === 0) {
            loadVideo(0, gSelectedVidGroup[0], gCurrMissionTimeSeconds + 1);
            loadVideo(1, gSelectedVidGroup[1], gCurrMissionTimeSeconds + 1);
            // for (var i = 0; i < 7; i++) {
            //     loadThumbVideo(i, gCurrMissionTimeSeconds);
            // }
        }

        //if video change this second
        for (var i = 0; i < gSelectedVidGroup.length; i++) {
            if (gVideoActivityByGroupBySecond[gSelectedVidGroup[i]][gLastMissionTimeSeconds] !== gVideoActivityByGroupBySecond[gSelectedVidGroup[i]][gCurrMissionTimeSeconds]) {
                loadVideo(i, gSelectedVidGroup[i], gCurrMissionTimeSeconds);
            }
        }

        //thumbnail vids
        // for (var i = 0; i < 7; i++) {
        //     if (gVideoActivityByGroupBySecond[i][gLastMissionTimeSeconds] !== gVideoActivityByGroupBySecond[i][gCurrMissionTimeSeconds]) {
        //         loadThumbVideo(i, gCurrMissionTimeSeconds);
        //     }
        // }
        // if (gCurrMissionTimeSeconds % 1 === 0) {  //every x seconds
        //     for (var i = 0; i < 7; i++) {
        //         if (gVideoActivityByGroupBySecond[i][gCurrMissionTimeSeconds] !== -1) {
        //             updateThumbVideoImage(i, gCurrMissionTimeSeconds);
        //         }
        //     }
        // }

        //use video0 to sync master clock if it's playing a video
        if (gVideoActivityByGroupBySecond[gSelectedVidGroup[0]][gCurrMissionTimeSeconds + 1] !== -1) {
            gCurrMissionTimeSeconds = parseInt(gSelectedVideoStartTimeSeconds[0] + document.getElementById("player0").currentTime);
        //or sync the clock to video1 if video0 is not available
        } else if (gVideoActivityByGroupBySecond[gSelectedVidGroup[1]][gCurrMissionTimeSeconds + 1] !== -1) {
            gCurrMissionTimeSeconds = parseInt(gSelectedVideoStartTimeSeconds[1] + document.getElementById("player1").currentTime);
        //or if neither video is available, just increment the clock
        } else {
            gCurrMissionTimeSeconds++;
        }

        //sync player1 to mission time //TODO this isn't really doing anything. What I want is for vid1 time to be exactly what vid0 is
        if (gVideoActivityByGroupBySecond[gSelectedVidGroup[0]][gCurrMissionTimeSeconds + 1] !== -1 && gVideoActivityByGroupBySecond[gSelectedVidGroup[1]][gCurrMissionTimeSeconds + 1] !== -1 && gVideoPlaying[1]) {
            var secondsOffsetFromBeginningOfVideo = gCurrMissionTimeSeconds - gSelectedVideoStartTimeSeconds[1];
            var playerElement = document.getElementById("player1");
            if (Math.abs(playerElement.currentTime - secondsOffsetFromBeginningOfVideo) > 1)
                playerElement.currentTime = secondsOffsetFromBeginningOfVideo;
        }

        if (gEVADate === '2019-08-21') { //todo total hack
            //sync audio with current mission time
            if (gSelectedAudioChannel !== -1) {
                var audioPlayerElement = document.getElementById("audio-element");
                var secondsOffsetFromBeginningOfAudioFile = gCurrMissionTimeSeconds - gAudioMetadata[gSelectedAudioChannel].startTimeSeconds;
                if (Math.abs(audioPlayerElement.currentTime - secondsOffsetFromBeginningOfAudioFile) > 1) {
                    audioPlayerElement.currentTime = secondsOffsetFromBeginningOfAudioFile;
                    console.log(audioPlayerElement.currentTime - secondsOffsetFromBeginningOfAudioFile);
                }
            }
        }

        if (document.getElementById('missionDate') !== document.activeElement) {
            $('input[name=missionDate]').val(shortdateFromZuluDate(secondsToZuluDate(gCurrMissionTimeSeconds)));
        }
        if (document.getElementById('missionTime') !== document.activeElement) {
            $('input[name=missionTime]').val(timeFromZuluDate(secondsToZuluDate(gCurrMissionTimeSeconds)));
        }

        setVidButtonHighlights(gCurrMissionTimeSeconds);
        setAudioButtonHighlights(gCurrMissionTimeSeconds);

        if (!gMouseOnNavigator) {
            drawTier1NavBox(gCurrMissionTimeSeconds);
            drawTier2();
            drawCursor(gCurrMissionTimeSeconds);
        }

        if (gCurrMissionTimeSeconds > gTimingData.EVA_duration_seconds) {
            clearInterval(gInterval);
        }
        gLastMissionTimeSeconds = gCurrMissionTimeSeconds;

    },1000);
}

function loadVideo(playerNum, group, second) {
    gSelectedVidGroup[playerNum] = group;
    setVidButtonHighlights(gCurrMissionTimeSeconds);

    var playerElement = document.getElementById('player' + playerNum);
    var checkSourceExists = document.getElementById("player" + playerNum + "source");
    if(!checkSourceExists) {
        var source = document.createElement('source');
        source.setAttribute("id", "player" + playerNum + "source");
        playerElement.appendChild(source);
    } else {
        source = document.getElementById("player" + playerNum + "source");
    }

    var vidIndex = gVideoActivityByGroupBySecond[group][second];

    //get video metadata
    if (vidIndex === -1) {
        var videoUrl = "/CODA_data/novid.mp4";
    } else {
        videoUrl = gVideoItems[vidIndex].videoUrl;
        //dev mod
        if (location.hostname === 'coda-iss.develop') { // use dev video location, otherwise use the stated IO URL
            var tempArray = videoUrl.split('/');
            var filename = tempArray[tempArray.length - 1];
            videoUrl = '/CODA_data/US_EVA_55/video/' + filename;
        }
    }
    if ($("#player" + playerNum + " source").attr("src") !== videoUrl) {
        source.setAttribute('src', videoUrl);
        playerElement.load();
    }

    var downlinkDisplay = 'D/L ' + (group + 1).toString();
    if (vidIndex === -1) {
        playerElement.muted = true;
    } else if (gVideoItems[vidIndex].className === 'downlink-LOS') {
        downlinkDisplay += ' (LOS)';
        playerElement.muted = true;
    } else {
        playerElement.muted = false;
    }
    if (playerNum === 1) //always mute player1
        playerElement.muted = true;

    playerElement.muted = true;

    if (vidIndex === -1) {
        document.getElementById('vidTitle' + playerNum).innerHTML = downlinkDisplay + ' | No video available.';
        document.getElementById('vidInfo' + playerNum).innerHTML = downlinkDisplay + ' | No video available.';
        gSelectedVideoStartTimeSeconds[playerNum] = gCurrMissionTimeSeconds;
    } else {
        document.getElementById('vidTitle' + playerNum).innerHTML = downlinkDisplay;
        document.getElementById('vidInfo' + playerNum).innerHTML = downlinkDisplay + ' | ' + gVideoItems[vidIndex].content + ' | ' + gVideoItems[vidIndex].description;
        //figure out how many seconds into video to seek to get to current mission time
        gSelectedVideoStartTimeSeconds[playerNum] = gVideoItems[vidIndex].missionSecondsStart;
    }

    var secondsOffsetFromBeginningOfVideo = gCurrMissionTimeSeconds - gSelectedVideoStartTimeSeconds[playerNum];
    if (Math.abs(playerElement.currentTime - secondsOffsetFromBeginningOfVideo) > 1)
        playerElement.currentTime = secondsOffsetFromBeginningOfVideo;

    playerElement.play();
}

function setVidButtonHighlights(second) {
    for (var group = 0; group < gSelectedVidGroup.length; group++) {
        for (var i = 0; i < gVideoActivityByGroupBySecond.length; i++) {
            if (i === gSelectedVidGroup[group]) {
                if (!document.getElementById('vid' + group + 'Button' + i.toString()).classList.contains('selected'))
                    document.getElementById('vid' + group + 'Button' + i.toString()).classList.add('selected');
            } else {
                if (document.getElementById('vid' + group + 'Button' + i.toString()).classList.contains('selected'))
                    document.getElementById('vid' + group + 'Button' + i.toString()).classList.remove('selected');
            }
            if (gVideoActivityByGroupBySecond[i][second] !== -1) {
                if (!document.getElementById('vid' + group + 'Button' + i.toString()).classList.contains('active') && !document.getElementById('vid' + group + 'Button' + i).classList.contains('selected'))
                    document.getElementById('vid' + group + 'Button' + i.toString()).classList.add('active');
            } else {
                document.getElementById('vid' + group + 'Button' + i.toString()).classList.remove('active');
            }
        }
    }
}

function loadThumbVideo(group, second) {
    var playerElement = document.getElementById('thumbPlayer' + group);
    var checkSourceExists = document.getElementById("thumbPlayer" + group + "source");
    if(!checkSourceExists) {
        var source = document.createElement('source');
        source.setAttribute("id", "thumbPlayer" + group + "source");
        playerElement.appendChild(source);
    } else {
        source = document.getElementById("thumbPlayer" + group + "source");
    }

    var vidIndex = gVideoActivityByGroupBySecond[group][second];

    //get video metadata
    if (vidIndex === -1) {
        var videoUrl = "/CODA_data/novid.mp4";
    } else {
        videoUrl = gVideoItems[vidIndex].videoUrl;
        //dev mod
        if (location.hostname === 'coda-iss.develop') { // use dev video location, otherwise use the stated IO URL
            var tempArray = videoUrl.split('/');
            var filename = tempArray[tempArray.length - 1];
            videoUrl = '/CODA_data/US_EVA_55/video/' + filename;
        }
    }
    if ($("#thumbPlayer" + group + " source").attr("src") !== videoUrl) {
        source.setAttribute('src', videoUrl);
        playerElement.load();
    }
    playerElement.muted = true;

    if (vidIndex !== -1) {
        var secondsOffsetFromBeginningOfVideo = gCurrMissionTimeSeconds - gGroupVideoStartTimeSeconds[group];
        if (Math.abs(playerElement.currentTime - secondsOffsetFromBeginningOfVideo) > 1)
            playerElement.currentTime = secondsOffsetFromBeginningOfVideo;
        gGroupVideoStartTimeSeconds[group] = gVideoItems[vidIndex].missionSecondsStart;
    }
    // playerElement.play();

}
function updateThumbVideoImage(group, second) {
    var playerElement = document.getElementById('thumbPlayer' + group);
    var vidIndex = gVideoActivityByGroupBySecond[group][second];
    if (vidIndex !== -1) {
        var secondsOffsetFromBeginningOfVideo = gCurrMissionTimeSeconds - gGroupVideoStartTimeSeconds[group];
        if (Math.abs(playerElement.currentTime - secondsOffsetFromBeginningOfVideo) > 1)
            playerElement.currentTime = secondsOffsetFromBeginningOfVideo;
        gGroupVideoStartTimeSeconds[group] = gVideoItems[vidIndex].missionSecondsStart;
    }
}

function setAudioButtonHighlights(second) {
    for (var i = 0; i < gAudioMetadata.length; i++) {
        var audioButtonElement = document.getElementById('audioButton' + i);
        audioButtonElement.classList.remove('active');
        audioButtonElement.classList.remove('selected');
        if (second >= gAudioMetadata[i].startTimeSeconds && second <= gAudioMetadata[i].endTimeSeconds) {
            audioButtonElement.classList.add('active');
            if (i === gSelectedAudioChannel) {
                audioButtonElement.classList.add('selected');
            }
        } else {
            //if selected audio channel does not have available audio this second, remove the source
            if (i === gSelectedAudioChannel) {
                audioButtonElement.classList.remove('selected');
                var audioElement = document.getElementById('audio-element');
                audioElement.pause();

                var audioSourceElement = document.getElementById('audio-element-source');
                audioElement.removeChild(audioSourceElement);
                gSelectedAudioChannel = -1;
            }
        }
    }
}

function playAudio(channelNum) {
    //if audio is available on that channel right now
    if (gCurrMissionTimeSeconds >= gAudioMetadata[channelNum].startTimeSeconds && gCurrMissionTimeSeconds <= gAudioMetadata[channelNum].endTimeSeconds) {
        gSelectedAudioChannel = channelNum;
        var playerElement = document.getElementById('audio-element');
        var checkSourceExists = document.getElementById("audio-element-source");
        if (!checkSourceExists) {
            var source = document.createElement('source');
            source.setAttribute("id", "audio-element-source");
            source.setAttribute('type', "audio/mpeg");
            playerElement.appendChild(source);
        } else {
            source = document.getElementById("audio-element-source");
        }

        var audioURL = '/CODA_data/US_EVA_55/audio/' + gAudioMetadata[channelNum].filename;

        if ($("#audio-element source").attr("src") !== audioURL) {
            source.setAttribute('src', audioURL);
            playerElement.load();
        }

        var secondsOffsetFromBeginningOfAudioFile = gCurrMissionTimeSeconds - gAudioMetadata[channelNum].startTimeSeconds;
        if (Math.abs(playerElement.currentTime - secondsOffsetFromBeginningOfAudioFile) > 1)
            playerElement.currentTime = secondsOffsetFromBeginningOfAudioFile;
        playerElement.play();
    }
}

function goButtonClick() {
    var missionDateStr = document.getElementById("missionDate").value;
    var missionTimeStr = document.getElementById("missionTime").value;

    var missionDateArr = missionDateStr.split('-');
    var missionTimeArr = missionTimeStr.split(':');

    if (document.getElementById("missionDate").value !== gEVADate) {
        var urlRoot = document.URL.substr(0,document.URL.lastIndexOf('/'));
        var URL = urlRoot + '?date=' + missionDateStr + '&GMT=' + missionTimeStr;
        window.location = URL;
    } else {
        var UTCDateFromFields = Date.UTC(
            missionDateArr[0], missionDateArr[1] - 1, missionDateArr[2], missionTimeArr[0], missionTimeArr[1], missionTimeArr[2]
        );
        gCurrMissionTimeSeconds = (UTCDateFromFields - gTimingData['video_earliestStart']) / 1000;
        gLastMissionTimeSeconds = 0;
    }
}

function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

function secondsToTimeStr(totalSeconds) {
    var hours = Math.abs(parseInt(totalSeconds / 3600));
    var minutes = Math.abs(parseInt(totalSeconds / 60)) % 60 % 60;
    var seconds = Math.abs(parseInt(totalSeconds)) % 60;
    seconds = Math.floor(seconds);
    var timeStr = padZeros(hours,2) + ":" + padZeros(minutes,2) + ":" + padZeros(seconds,2);
    if (totalSeconds < 0) {
        timeStr = "-" + timeStr.substr(1); //change timeStr to negative, replacing leading zero in hours with "-"
    }
    return timeStr;
}

function timeStrToSeconds(timeStr) {
    var sign = timeStr.substr(0,1);
    var hours = parseInt(timeStr.substr(0,2));
    var minutes = parseInt(timeStr.substr(3,2));
    var seconds = parseInt(timeStr.substr(6,2));
    var signToggle = (sign === "-") ? -1 : 1;
    var totalSeconds = Math.round(signToggle * ((Math.abs(hours) * 60 * 60) + (minutes * 60) + seconds));

    return totalSeconds;
}

function secondsToZuluString(seconds) {
    var zuluDate = secondsToZuluDate(seconds);
    var temp = zuluDate.toISOString().split('T')[1].split(':');
    return temp[0] + ":" + temp[1] + ":" + temp[2].split('.')[0] + 'Z';
}

function secondsToZuluDate(seconds) {
    return new Date(gTimingData.video_earliestStart.getTime() + seconds * 1000);
}

function zuluDateToSeconds(zuluDate) {
    return (zuluDate.getTime() - gTimingData.video_earliestStart.getTime()) / 1000;
}

function timeFromZuluDate(zuluDate) {
    return padZeros(zuluDate.getUTCHours(), 2) + ":" + padZeros(zuluDate.getUTCMinutes(), 2) + ":" + padZeros(zuluDate.getUTCSeconds(), 2);
}

function shortdateFromZuluDate(zuluDate) {
    return padZeros(zuluDate.getUTCFullYear(), 2) + "-" + padZeros(zuluDate.getUTCMonth() + 1, 2) + "-" + padZeros(zuluDate.getUTCDate(), 2);
}

function padZeros(num, size) {
    var s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

function setEventHandlers() {
    document.getElementById("player0").addEventListener("play", function () {
        // startInterval();
        document.getElementById('player1').play();
        if (gSelectedAudioChannel !== -1)
            document.getElementById('audio-element').play();
    }, true);
    document.getElementById("player0").addEventListener("playing", function () {
        gVideoPlaying[0] = true;
    }, true);
    document.getElementById("player0").addEventListener("pause", function () {
        gVideoPlaying[0] = false;
        document.getElementById('player1').pause();
        if (gSelectedAudioChannel !== -1)
            document.getElementById('audio-element').pause();
        // clearInterval(gTimer);
    }, true);
    document.getElementById('player0').addEventListener('ended', function () {
        gVideoPlaying[0] = false;
    }, true);

    document.getElementById("player1").addEventListener("play", function () {
        // startInterval();
        document.getElementById('player0').play();
        if (gSelectedAudioChannel !== -1)
            document.getElementById('audio-element').play();
    }, true);
    document.getElementById("player1").addEventListener("playing", function () {
        gVideoPlaying[1] = true;
    }, true);
    document.getElementById("player1").addEventListener("pause", function () {
        gVideoPlaying[1] = false;
        document.getElementById('player0').pause();
        if (gSelectedAudioChannel !== -1)
            document.getElementById('audio-element').pause();
        // clearInterval(gTimer);
    }, true);
    document.getElementById('player1').addEventListener('ended', function () {
        gVideoPlaying[1] = false;
    }, true);

}