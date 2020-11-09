import VideoPlayer from "./video-player";
import AudioPlayer from "./audio-player";

function AVPanels() {
  return (
    <div id="panelsContainer">
      <AudioPlayer />
      <VideoPlayer id={0} />
      <VideoPlayer id={1} />
    </div>
  );
}

export default AVPanels;
