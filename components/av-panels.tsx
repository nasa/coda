import VideoPlayer from "./video-player";
import AudioPlayer from "./audio-player";

function AVPanels({ gVideoActivityByGroupBySecond }) {
  return (
    <div id="panelsContainer">
      <AudioPlayer />
      <VideoPlayer
        id={0}
        gVideoActivityByGroupBySecond={gVideoActivityByGroupBySecond}
      />
      <VideoPlayer
        id={1}
        gVideoActivityByGroupBySecond={gVideoActivityByGroupBySecond}
      />
    </div>
  );
}

export default AVPanels;
