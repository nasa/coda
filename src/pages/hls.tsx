import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

const HLSPlayer: React.FC<{ streamUrl: string }> = ({ streamUrl }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [availableDuration, setAvailableDuration] = useState(0);
  const [startTime, setStartTime] = useState("");

  const secondsToHHMMSS = (d: number) => {
    // output format: HH:MM:SS
    const hours = Math.floor(d / 3600);
    const minutes = Math.floor((d % 3600) / 60);
    const seconds = Math.floor(d % 60);
    return [hours, minutes, seconds]
      .map((v) => (v < 10 ? "0" + v : v))
      .filter((v, i) => v !== "00" || i > 0)
      .join(":");
  };

  const seekToLive = () => {
    const video = videoRef.current;
    if (!video || !hlsRef.current) return;
    const liveEdge = hlsRef.current.liveSyncPosition;

    video.currentTime = liveEdge ?? 0;
  };

  useEffect(() => {
    if (Hls.isSupported()) {
      hlsRef.current = new Hls({
        startPosition: -1,
        liveDurationInfinity: true,
        maxBufferLength: 510, // About 8.5 minutes in seconds
        maxMaxBufferLength: 510,
      });
      const video = videoRef.current;

      if (video) {
        hlsRef.current.loadSource(streamUrl);
        hlsRef.current.attachMedia(video);

        hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play();
        });

        hlsRef.current.on(Hls.Events.LEVEL_UPDATED, () => {
          const availableSegments = hlsRef.current?.levels[0].details?.fragments;
          if (!availableSegments) return;
          let totalDuration = 0;
          // Sum up the duration of all available segments
          availableSegments.forEach((fragment) => {
            totalDuration += fragment.duration;
          });
          setAvailableDuration(totalDuration);

          // Set the start time of the stream
          const unixTime = availableSegments[0].programDateTime;
          setStartTime(unixTime ? new Date(unixTime).toISOString() : "");
        });
      }
    } else if (videoRef.current && videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      // Fallback for Safari browser which supports HLS natively
      console.log("fallback");
      videoRef.current.src = streamUrl;
      videoRef.current.addEventListener("loadedmetadata", () => {
        videoRef.current?.play();
      });
    }

    // Cleanup the Hls instance when the component is unmounted
    return () => {
      hlsRef.current?.destroy();
    };
  }, [streamUrl]);

  return (
    <div>
      <video ref={videoRef} muted controls style={{ width: "800px", height: "auto" }} />
      <div>Duration: {secondsToHHMMSS(availableDuration)}</div>
      <div>Start time available UTC: {startTime}</div>
      <button
        onClick={() => {
          const availableSegments = hlsRef.current?.levels[0].details?.fragments;
          if (!availableSegments || !videoRef.current) return;
          // subtract 5 seconds from the start time because that's how long the hls buffer is
          const startTime = (availableSegments[0].programDateTime ?? 0) - 5000;
          const targetTime = new Date("2024-11-02T21:55:00Z");
          const diffSeconds = (targetTime.getTime() - startTime) / 1000;
          videoRef.current.currentTime = diffSeconds;
        }}
      >
        Jump to 2:00
      </button>
      <button
        onClick={() => {
          seekToLive();
        }}
      >
        Seek to live
      </button>
    </div>
  );
};

export default function Page(): React.ReactElement {
  return (
    <div>
      <h1>HLS Live stream with MediaMTX</h1>
      {/* <HLSPlayer streamUrl="http://localhost:8888/DL1_ISS/index.m3u8" /> */}
      <HLSPlayer streamUrl="http://localhost:8888/DL1_TE/index.m3u8" />
    </div>
  );
}
