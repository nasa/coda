import { useRouter } from "next/router";
import VideoPlayer from "./video-player";
import AudioPlayer from "./audio-player";

function AVPanels({ gVideoActivityByGroupBySecond }) {
  // get query parameters asking for specific video sources
  const {
    query: { videoSource1 = null, videoSource2 = null },
  }: {
    query: { videoSource1?: string; videoSource2?: string };
  } = useRouter();

  return (
    <div id="panelsContainer">
      <AudioPlayer />
      <VideoPlayer
        id={0}
        selectedSource={videoSource1}
        gVideoActivityByGroupBySecond={gVideoActivityByGroupBySecond}
      />
      <VideoPlayer
        id={1}
        selectedSource={videoSource2}
        gVideoActivityByGroupBySecond={gVideoActivityByGroupBySecond}
      />
    </div>
  );
}

export default AVPanels;
