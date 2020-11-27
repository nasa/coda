import { createRef, useContext } from "react";
import { TimeSyncDispatch, TimeSyncState } from "store/contexts";

const gCurrMissionTimeSeconds = 0;
// TODO remove
const gSelectedVidGroup = {};
const gSelectedVideoStartTimeSeconds = {};

/**
 * Renders an individual video including the video group picker
 */
function VideoPlayer({
  id,
  gVideoActivityByGroupBySecond,
  gVideoItems,
  selectedSource,
}) {
  const dispatch = useContext(TimeSyncDispatch);
  const { currentVideos } = useContext(TimeSyncState);

  const vidIndex = currentVideos[id];

  const player = createRef();
  const source = createRef();

  // default video info
  let videoURL = "https://coda-dev.fit.nasa.gov/CODA_data/novid.mp4";
  let downlinkDisplay = "No video available";
  let vidInfo = "";

  gSelectedVidGroup[id] = currentVideos[id].videoSource;

  const loadVideo = () => {
    setVidButtonHighlights(gCurrMissionTimeSeconds);

    const vidIndex = gVideoActivityByGroupBySecond[group][second];
    if (vidIndex >= 0) {
      videoURL = gVideoItems[vidIndex].videoUrl;
    } else {
      console.log(player);
      player.current.muted = true;
    }

    downlinkDisplay = `D/L ${group + 1}`;
    if (
      gVideoItems[vidIndex] &&
      gVideoItems[vidIndex].className === "downlink-LOS"
    ) {
      downlinkDisplay += " (LOS)";
      player.current.muted = true;
    } else {
      player.current.muted = false;
    }

    //always mute player1
    if (playerNum === 1) {
      player.current.muted = true;
    }

    if (vidIndex === -1) {
      downlinkDisplay = downlinkDisplay + " | No video available.";
      vidInfo = downlinkDisplay + " | No video available.";
      // TODO why is this here?
      gSelectedVideoStartTimeSeconds[playerNum] = gCurrMissionTimeSeconds;
    } else {
      vidInfo = `${downlinkDisplay} | ${gVideoItems[vidIndex].content} | ${gVideoItems[vidIndex].description}`;
      // figure out how many seconds into video to seek to get to current mission time
      gSelectedVideoStartTimeSeconds[playerNum] =
        gVideoItems[vidIndex].missionSecondsStart;
    }

    const secondsOffsetFromBeginningOfVideo =
      gCurrMissionTimeSeconds - gSelectedVideoStartTimeSeconds[playerNum];
    if (
      Math.abs(player.current.currentTime - secondsOffsetFromBeginningOfVideo) >
      1
    ) {
      player.current.currentTime = secondsOffsetFromBeginningOfVideo;
    }

    player.current.load();
    player.current.play();
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
        {downlinkDisplay}
      </div>
      <div className="vidContainer">
        <video ref={player} className="player" id={id} controls>
          <source src={videoURL} ref={source} />
        </video>
        <div className="vidOverlay">
          <div id="vidInfo0" className="vidInfo">
            {vidInfo}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
