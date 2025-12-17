import { FunctionComponent, useState } from "react";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { determineVideoPlayerType } from "utils/video";
import ClockInterval from "components/framework/ClockInterval";
import VideoMTXPlaybackPane from "./video-player-mtx";
import VideoHlsPane from "./video-player-hls";
import { VideoIOPane } from "./video-player-io";
import { VideoPosterPane } from "./video-poster";

/**
 * VideoPaneChooser determines which video player component to render based on
 * available video sources and the current playhead position.
 *
 * Priority order:
 * 1. IO (Imagery Online) - if available, always preferred
 * 2. HLS (HTTP Live Streaming) - for near-live playback
 * 3. MTX (MediaMTX recordings) - for recorded playback
 * 4. Falls back to poster pane if nothing is available
 */
const VideoPaneChooser: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const videos = useAppSelector((state) => state.videos, deepEqual);
  const downlinkNumber = useAppSelector(
    (state) => (state.framework.frames[frameID].paneStateData.channel + 1) as number,
    refEqual
  );
  const mtxPlaybackRecordsForDownlink = useAppSelector(
    (state) => state.videos.mtxPlaybackAvailability[downlinkNumber],
    deepEqual
  );
  const source = useAppSelector((state) => state.framework.source, refEqual);
  const playheadDate = useAppSelector((state) => state.clock.date, refEqual);

  const [appSeconds, setLocalAppSeconds] = useState(0);

  // if live video system is disabled, always show the IO player
  const liveEnabled = import.meta.env.VITE_PUBLIC_LIVE_STREAMS_ENABLED === "true";
  if (!liveEnabled) {
    return (
      <>
        <ClockInterval setAppSeconds={setLocalAppSeconds} />
        <VideoIOPane frameID={frameID} />
      </>
    );
  }

  const videoPlayerType = determineVideoPlayerType({
    downlinkNumber,
    mtxPlaybackRecordsForDownlink,
    videos,
    date: playheadDate,
    appSeconds,
    source,
  });

  let PlayerComponent;
  switch (videoPlayerType) {
    case "MTX":
      PlayerComponent = VideoMTXPlaybackPane;
      break;
    case "HLS":
      PlayerComponent = VideoHlsPane;
      break;
    case "IO":
      PlayerComponent = VideoIOPane;
      break;
    default:
      PlayerComponent = VideoPosterPane;
  }

  return (
    <>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      <PlayerComponent frameID={frameID} />
    </>
  );
};

export default VideoPaneChooser;
