import { useRouter } from "next/router";
import VideoPlayer from "./video-player";
import AudioPlayer from "./audio-player";

function AVPanels({ gVideoActivityByGroupBySecond, gVideoItems }) {
  // get query parameters asking for specific video sources
  // see https://nextjs.org/docs/routing/dynamic-routes
  // FYI: the syntax here is how you declare default parameters and types simultaneously for a destructured object with TS
  // see https://mariusschulz.com/blog/typing-destructured-object-parameters-in-typescript
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
        gVideoItems={gVideoItems}
      />
      <VideoPlayer
        id={1}
        selectedSource={videoSource2}
        gVideoActivityByGroupBySecond={gVideoActivityByGroupBySecond}
        gVideoItems={gVideoItems}
      />
    </div>
  );
}

export default AVPanels;
