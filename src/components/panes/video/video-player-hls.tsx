import { FunctionComponent, useEffect, useRef, useState } from "react";
import { useAppDispatch } from "utils/useAppDispatch";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import styles from "./video-player-hls.module.css";
import { setPaneStateDataValue } from "store/framework";
import HelpOverlay from "components/interface/pane-help-overlay";
import { VideoHLSHelpContent } from "./video-help";
import Hls from "hls.js";
import { appSecondsFromDateString, dateFromAppSeconds } from "utils/formatting";
import ConsoleLogger from "utils/logging/consoleLogger";
import ClockInterval from "components/framework/ClockInterval";
import { getSourceSuffix } from "utils/video";
import { usePlayheadDate } from "store/hooks";

const VideoHlsPane: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const dispatch = useAppDispatch();

  const source = useAppSelector((state) => state.framework.source, refEqual);
  const paneStateData = useAppSelector(
    (state) => state.framework.frames[frameID].paneStateData as VideoPaneStateData,
    deepEqual
  );
  const mtxHlsEndpoints = useAppSelector((state) => state.videos.mtxHlsEndpoints, deepEqual);

  const [hlsAvailable, setHlsAvailable] = useState(false);

  const isRunning = useAppSelector((state) => state.clock.isRunning, refEqual);
  const playheadDate = usePlayheadDate();
  const [appSeconds, setLocalAppSeconds] = useState(0);

  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const downlinkNumber = (paneStateData.channel + 1).toString();

  const playOrPause = () => {
    const asyncFunc = async () => {
      if (!videoRef.current) return;
      try {
        if (isRunning) {
          // if the video is not playing, try to play it
          if (videoRef.current.paused) {
            await videoRef.current.play();
          }
        } else {
          // make sure the video is paused when the playhead isn't running
          // if the video is playing, pause it
          if (!videoRef.current.paused) {
            await videoRef.current.pause();
          }
        }
      } catch (e: unknown) {
        // ignore errors
      }
    };
    asyncFunc();
  };

  const syncToPlayhead = () => {
    if (!hlsRef.current || !videoRef.current || !playheadDate) return;

    // if the appSeconds is within 10 second of the current time, just go to the live edge of the hls stream
    if (Math.abs(appSeconds - appSecondsFromDateString(new Date().toISOString())) < 5) {
      const liveSyncPosition = hlsRef.current.liveSyncPosition;
      if (liveSyncPosition === null || liveSyncPosition - videoRef.current.currentTime < 3) return; // don't sync if we're already close to the live edge
      videoRef.current.currentTime = liveSyncPosition;
      return;
    }

    // otherwise, figure out how many seconds to seek to get to the desired appSeconds
    const playheadDateObj = dateFromAppSeconds(appSeconds, playheadDate);
    const hlsPlayingDate = hlsRef.current.playingDate;
    if (!hlsPlayingDate) return;

    const secondsToSeek =
      Math.floor((playheadDateObj.getTime() - hlsPlayingDate.getTime()) / 1000) + 2; // add a fudge to the secondsToSee to make the video play at the correct time
    if (Math.abs(secondsToSeek) < 4) return;

    const videoElementCurrentTime = videoRef.current.currentTime;
    const newVideoElementCurrentTime = videoElementCurrentTime + secondsToSeek;
    videoRef.current.currentTime = newVideoElementCurrentTime;
  };

  const prepareHlsPlayer = () => {
    if (!videoRef.current || !mtxHlsEndpoints || mtxHlsEndpoints.length === 0) return;

    const downlinkNumber = (paneStateData.channel + 1).toString();
    const sourceSuffix = getSourceSuffix(source);

    const streamEndpointName = `DL${downlinkNumber}_${sourceSuffix}` as MTXHlsEndpointName;

    // check if the endpoint name is in the list of available endpoints from medaimtx
    const mtxHlsEndpointNames = mtxHlsEndpoints.map((endpoint) => endpoint.name);
    if (!mtxHlsEndpointNames.includes(streamEndpointName)) {
      return;
    }

    const mtxHlsBaseUrl = import.meta.env.VITE_PUBLIC_MEDIA_MTX_HLS_URL;

    if (Hls.isSupported()) {
      if (!hlsRef.current) {
        hlsRef.current = new Hls({
          startPosition: -1,
          liveDurationInfinity: true,
          maxBufferLength: 510, // About 8.5 minutes in seconds
          maxMaxBufferLength: 510,
        });

        hlsRef.current.loadSource(`${mtxHlsBaseUrl}${streamEndpointName}/index.m3u8`);
        hlsRef.current.attachMedia(videoRef.current);

        hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
          dispatch(
            setPaneStateDataValue({ frameID, paneStateProperty: "ready", paneStateValue: true })
          );
        });

        // Handle errors gracefully
        hlsRef.current.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                ConsoleLogger.error("HLS: Fatal network error, attempting recovery...");
                hlsRef.current?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                ConsoleLogger.error("HLS: Fatal media error, attempting recovery...");
                hlsRef.current?.recoverMediaError();
                break;
              default:
                ConsoleLogger.error("HLS: Fatal error, destroying instance");
                hlsRef.current?.destroy();
                hlsRef.current = null;
                break;
            }
          }
        });
      }
    } else {
      // Fallback for Safari browser which supports HLS natively
      console.log("fallback for safari");
      try {
        const videoElement = videoRef.current;
        if (!videoElement) return;
        videoElement.src = `${mtxHlsBaseUrl}${streamEndpointName}/index.m3u8`;
        videoElement.addEventListener("loadedmetadata", () => {
          videoElement.play();
        });
      } catch (e) {
        console.error(e);
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  };

  const toggleFullScreen = () => {
    const el = videoRef.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  useEffect(() => {
    // is there an hls endpoint for this channel?
    let hlsForThisChannel = false;

    // loop through the hlsEndpointNames and look for this downlink channel
    for (const mtxHlsEndpoint of mtxHlsEndpoints) {
      if (mtxHlsEndpoint.name.includes(downlinkNumber)) {
        hlsForThisChannel = true;
      }
    }
    setHlsAvailable(hlsForThisChannel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- downlinkNumber is derived from paneStateData.channel which is stable
  }, [mtxHlsEndpoints]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- imperative HLS player setup requires ref.current access
  useEffect(prepareHlsPlayer, [mtxHlsEndpoints, videoRef.current, paneStateData]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- imperative video sync requires ref.current access
  useEffect(syncToPlayhead, [hlsRef.current, appSeconds]);
  useEffect(playOrPause, [isRunning, appSeconds]);

  return (
    <div
      key={`video_element__${frameID}`}
      className={styles.vidContainer}
      data-frame-id={"HLS Player"}
    >
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      {!hlsAvailable ? <div className={styles.playerPosterNovid}></div> : null}
      <video
        muted
        ref={videoRef}
        className={styles.player}
        onError={(e) => {
          const vidElement = e.target as HTMLVideoElement;
          if (!vidElement.error?.message.includes("mpty")) {
            console.error(
              `video ${frameID} has thrown an error ${vidElement.error?.code} - ${vidElement.error?.message}`
            );
          }
        }}
        onClick={() => {
          toggleFullScreen();
        }}
      />

      <HelpOverlay
        isModalOpen={paneStateData.showHelp}
        closeHandler={() => {
          dispatch(
            setPaneStateDataValue({
              frameID,
              paneStateProperty: "showHelp",
              paneStateValue: !paneStateData.showHelp,
            })
          );
        }}
      >
        <VideoHLSHelpContent />
      </HelpOverlay>
    </div>
  );
};

export default VideoHlsPane;
