import React from "react";

const gCurrMissionTimeSeconds = 0;
// TODO remove
const gSelectedVidGroup = {};
const gSelectedVideoStartTimeSeconds = {};

function VideoPlayer({
  id,
  gVideoActivityByGroupBySecond,
  gVideoItems,
  selectedSource,
}) {
  const player = React.createRef();

  const loadVideo = (playerNum, group, second) => {
    gSelectedVidGroup[playerNum] = group;
    setVidButtonHighlights(gCurrMissionTimeSeconds);

    var checkSourceExists = document.getElementById(
      "player" + playerNum + "source"
    );
    if (!checkSourceExists) {
      var source = document.createElement("source");
      source.setAttribute("id", "player" + playerNum + "source");
      player.appendChild(source);
    } else {
      source = document.getElementById("player" + playerNum + "source");
    }

    var vidIndex = gVideoActivityByGroupBySecond[group][second];

    //get video metadata
    if (vidIndex === -1) {
      var videoUrl = "/CODA_data/novid.mp4";
      if (location.hostname === "localhost") {
        videoUrl = "https://coda-dev.fit.nasa.gov" + videoUrl;
      }
    } else {
      videoUrl = gVideoItems[vidIndex].videoUrl;
      //dev mod
      if (location.hostname === "coda-iss.develop") {
        // use dev video location, otherwise use the stated IO URL
        var tempArray = videoUrl.split("/");
        var filename = tempArray[tempArray.length - 1];
        videoUrl = "/CODA_data/US_EVA_55/video/" + filename;
      }
    }
    if ($("#player" + playerNum + " source").attr("src") !== videoUrl) {
      source.setAttribute("src", videoUrl);
      player.load();
    }

    var downlinkDisplay = "D/L " + (group + 1).toString();
    if (vidIndex === -1) {
      player.muted = true;
    } else if (gVideoItems[vidIndex].className === "downlink-LOS") {
      downlinkDisplay += " (LOS)";
      player.muted = true;
    } else {
      player.muted = false;
    }
    if (playerNum === 1)
      //always mute player1
      player.muted = true;

    player.muted = true;

    if (vidIndex === -1) {
      document.getElementById("vidTitle" + playerNum).innerHTML =
        downlinkDisplay + " | No video available.";
      document.getElementById("vidInfo" + playerNum).innerHTML =
        downlinkDisplay + " | No video available.";
      gSelectedVideoStartTimeSeconds[playerNum] = gCurrMissionTimeSeconds;
    } else {
      document.getElementById(
        "vidTitle" + playerNum
      ).innerHTML = downlinkDisplay;
      document.getElementById("vidInfo" + playerNum).innerHTML =
        downlinkDisplay +
        " | " +
        gVideoItems[vidIndex].content +
        " | " +
        gVideoItems[vidIndex].description;
      //figure out how many seconds into video to seek to get to current mission time
      gSelectedVideoStartTimeSeconds[playerNum] =
        gVideoItems[vidIndex].missionSecondsStart;
    }

    var secondsOffsetFromBeginningOfVideo =
      gCurrMissionTimeSeconds - gSelectedVideoStartTimeSeconds[playerNum];
    if (Math.abs(player.currentTime - secondsOffsetFromBeginningOfVideo) > 1)
      player.currentTime = secondsOffsetFromBeginningOfVideo;

    player.play();
  };

  const setVidButtonHighlights = (second) => {
    for (var group = 0; group < gSelectedVidGroup.length; group++) {
      for (var i = 0; i < gVideoActivityByGroupBySecond.length; i++) {
        if (i === gSelectedVidGroup[group]) {
          if (
            !document
              .getElementById("vid" + group + "Button" + i.toString())
              .classList.contains("selected")
          )
            document
              .getElementById("vid" + group + "Button" + i.toString())
              .classList.add("selected");
        } else {
          if (
            document
              .getElementById("vid" + group + "Button" + i.toString())
              .classList.contains("selected")
          )
            document
              .getElementById("vid" + group + "Button" + i.toString())
              .classList.remove("selected");
        }
        if (gVideoActivityByGroupBySecond[i][second] !== -1) {
          if (
            !document
              .getElementById("vid" + group + "Button" + i.toString())
              .classList.contains("active") &&
            !document
              .getElementById("vid" + group + "Button" + i)
              .classList.contains("selected")
          )
            document
              .getElementById("vid" + group + "Button" + i.toString())
              .classList.add("active");
        } else {
          document
            .getElementById("vid" + group + "Button" + i.toString())
            .classList.remove("active");
        }
      }
    }
  };

  return (
    <div className="vidPanel">
      <div>
        <button
          id="vid0Button0"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 0, gCurrMissionTimeSeconds)}
        >
          D/L 1
        </button>
        <button
          id="vid0Button1"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 1, gCurrMissionTimeSeconds)}
        >
          D/L 2
        </button>
        <button
          id="vid0Button2"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 2, gCurrMissionTimeSeconds)}
        >
          D/L 3
        </button>
        <button
          id="vid0Button3"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 3, gCurrMissionTimeSeconds)}
        >
          D/L 4
        </button>
        <button
          id="vid0Button4"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 4, gCurrMissionTimeSeconds)}
        >
          D/L 5
        </button>
        <button
          id="vid0Button5"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 5, gCurrMissionTimeSeconds)}
        >
          D/L 6
        </button>
        <button
          id="vid0Button6"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 6, gCurrMissionTimeSeconds)}
        >
          non-D/L
        </button>
      </div>

      <div id="vidTitle0" className="vidTitle">
        vidTitle
      </div>
      <div className="vidContainer">
        <video ref={player} className="player" id={id} controls></video>
        <div className="vidOverlay">
          <div id="vidInfo0" className="vidInfo">
            vidInfo
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
