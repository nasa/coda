import { useContext, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { getMissionTime, historySelector } from "store/clock";
import { pickGroup, VideosState } from "store/videos";

const noVidURL = "https://coda-dev.fit.nasa.gov/CODA_data/novid.mp4";

/**
 * Renders an individual video including the video group picker
 */
function VideoPlayer({
  name,
}: {
  /** Identifies this video player so we know what group to play. It should match a key in `store.videos.selectedGroups` */
  name: string;
}) {
  const dispatch = useDispatch();
  const videos: VideosState = useSelector((state) => state.videos);
  const videoID = videos.activeVideoFiles[name];
  console.log(name, videoID);

  const player = useRef();
  const source = useRef();

  // default video info
  let videoURL = noVidURL;
  let downlinkDisplay = "No video available";
  let vidInfo = "";
  if (videoID !== "") {
    const video = videos.videos[videoID];
    videoURL = video.videoURL;
    vidInfo = video.description;
    downlinkDisplay = video.content;
    player.current.load();
    player.current.play();
  }

  // gSelectedVidGroup[id] = currentVideos[id].videoSource;

  // const dispatch(pickGroup {name, group:  } ){
  //   setVidButtonHighlights(missionTime);

  //   const vidIndex = videoActivity[group][second];
  //   if (vidIndex >= 0) {
  //     videoURL = videoFiles[vidIndex].videoUrl;
  //   } else {
  //     console.log(player);
  //     player.current.muted = true;
  //   }

  //   downlinkDisplay = `D/L ${group + 1}`;
  //   if (
  //     videoFiles[vidIndex] &&
  //     videoFiles[vidIndex].className === "downlink-LOS"
  //   ) {
  //     downlinkDisplay += " (LOS)";
  //     player.current.muted = true;
  //   } else {
  //     player.current.muted = false;
  //   }

  //   //always mute player1
  //   if (playerNum === 1) {
  //     player.current.muted = true;
  //   }

  //   if (vidIndex === -1) {
  //     downlinkDisplay = downlinkDisplay + " | No video available.";
  //     vidInfo = downlinkDisplay + " | No video available.";
  //     // TODO why is this here?
  //     gSelectedVideoStartTimeSeconds[playerNum] = missionTime;
  //   } else {
  //     vidInfo = `${downlinkDisplay} | ${videoFiles[vidIndex].content} | $vVideoFiles[vidIndex].description}`;
  //     // figure out how many seconds into video to seek to get to current mission time
  //     gSelectedVideoStartTimeSeconds[playerNum] =
  //       videoFiles[vidIndex].missionSecondsStart;
  //   }

  //   const secondsOffsetFromBeginningOfVideo =
  //     missionTime - gSelectedVideoStartTimeSeconds[playerNum];
  //   if (
  //     Math.abs(player.current.currentTime - secondsOffsetFromBeginningOfVideo) >
  //     1
  //   ) {
  //     player.current.currentTime = secondsOffsetFromBeginningOfVideo;
  //   }

  // };

  // const setVidButtonHighlights = (second) => {
  //   for (var group = 0; group < gSelectedVidGroup.length; group++) {
  //     for (var i = 0; i < videoActivity.length; i++) {
  //       if (i === gSelectedVidGroup[group]) {
  //         if (
  //           !document
  //             .getElementById("vid" + group + "Button" + i.toString())
  //             .classList.contains("selected")
  //         )
  //           document
  //             .getElementById("vid" + group + "Button" + i.toString())
  //             .classList.add("selected");
  //       } else {
  //         if (
  //           document
  //             .getElementById("vid" + group + "Button" + i.toString())
  //             .classList.contains("selected")
  //         )
  //           document
  //             .getElementById("vid" + group + "Button" + i.toString())
  //             .classList.remove("selected");
  //       }
  //       if (videoActivity[i][second] !== -1) {
  //         if (
  //           !document
  //             .getElementById("vid" + group + "Button" + i.toString())
  //             .classList.contains("active") &&
  //           !document
  //             .getElementById("vid" + group + "Button" + i)
  //             .classList.contains("selected")
  //         )
  //           document
  //             .getElementById("vid" + group + "Button" + i.toString())
  //             .classList.add("active");
  //       } else {
  //         document
  //           .getElementById("vid" + group + "Button" + i.toString())
  //           .classList.remove("active");
  //       }
  //     }
  //   }
  // };

  return (
    <div className="vidPanel">
      <div>
        <button
          id="vid0Button0"
          type="button"
          className="vidButton"
          onClick={() => dispatch(pickGroup({ name, group: 0 }))}
        >
          D/L 1
        </button>
        <button
          id="vid0Button1"
          type="button"
          className="vidButton"
          onClick={() => dispatch(pickGroup({ name, group: 1 }))}
        >
          D/L 2
        </button>
        <button
          id="vid0Button2"
          type="button"
          className="vidButton"
          onClick={() => dispatch(pickGroup({ name, group: 2 }))}
        >
          D/L 3
        </button>
        <button
          id="vid0Button3"
          type="button"
          className="vidButton"
          onClick={() => dispatch(pickGroup({ name, group: 3 }))}
        >
          D/L 4
        </button>
        <button
          id="vid0Button4"
          type="button"
          className="vidButton"
          onClick={() => dispatch(pickGroup({ name, group: 4 }))}
        >
          D/L 5
        </button>
        <button
          id="vid0Button5"
          type="button"
          className="vidButton"
          onClick={() => dispatch(pickGroup({ name, group: 5 }))}
        >
          D/L 6
        </button>
        <button
          id="vid0Button6"
          type="button"
          className="vidButton"
          onClick={() => dispatch(pickGroup({ name, group: 6 }))}
        >
          non-D/L
        </button>
      </div>

      <div id="vidTitle0" className="vidTitle">
        {downlinkDisplay}
      </div>
      <div className="vidContainer">
        <video ref={player} className="player" controls>
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
