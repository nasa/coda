import { FunctionComponent, MutableRefObject, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "store/index";
import styles from "./video.module.css";
import { setPaneStateValue } from "store/framework";
import HelpOverlay from "components/interface/pane-help-overlay";
import Hls from "hls.js";
import { appSecondsFromDateString, dateFromAppSeconds } from "utils/formatting";

const VideoHlsPane: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const dispatch = useDispatch();
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const source = useSelector((state: RootState) => state.framework.source);
  const paneStateData: VideoPaneStateData = useSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData
  );
  const mtxHlsEndpointNames = useSelector((state: RootState) => state.videos.mtxHlsEndpointNames);

  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef() as MutableRefObject<HTMLVideoElement>;

  const [hlsAvailable, setHlsAvailable] = useState(false);

  const downlinkNumber = (paneStateData.channel + 1).toString();

  const playOrPause = () => {
    const asyncFunc = async () => {
      try {
        if (playhead.isRunning) {
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
    if (!hlsRef.current) return;

    // if the playhead.seconds is within 10 second of the current time, just go to the live edge of the hls stream
    if (Math.abs(playhead.seconds - appSecondsFromDateString(new Date().toISOString())) < 5) {
      if (hlsRef.current.liveSyncPosition - videoRef.current.currentTime < 3) return; // don't sync if we're already close to the live edge
      const liveEdge = hlsRef.current.liveSyncPosition;
      videoRef.current.currentTime = liveEdge;
      return;
    }

    // otherwise, figure out how many seconds to seek to get to the desired appSeconds
    const playheadDate = dateFromAppSeconds(playhead.seconds, playhead.date);
    const hlsPlayingDate = hlsRef.current.playingDate;
    if (!hlsPlayingDate) return;

    let secondsToSeek = Math.floor((playheadDate.getTime() - hlsPlayingDate.getTime()) / 1000) + 2; // add a fudge to the secondsToSee to make the video play at the correct time
    if (Math.abs(secondsToSeek) < 4) return;

    const videoElementCurrentTime = videoRef.current.currentTime;
    const newVideoElementCurrentTime = videoElementCurrentTime + secondsToSeek;
    videoRef.current.currentTime = newVideoElementCurrentTime;
  };

  const prepareHlsPlayer = () => {
    if (!videoRef.current || !mtxHlsEndpointNames || mtxHlsEndpointNames.length === 0) return;

    const downlinkNumber = (paneStateData.channel + 1).toString();
    const sourceSuffix = source === "ISS" ? "ISS" : "TE";

    const streamEndpointName = `DL${downlinkNumber}_${sourceSuffix}` as MTXHlsEndpointName;

    // check if the endpoint name is in the list of available endpoints from medaimtx
    if (!mtxHlsEndpointNames.includes(streamEndpointName)) {
      return;
    }

    const mtxHlsBaseUrl =
      import.meta.env.VITE_PUBLIC_MOCK_LIVE_STREAMS === "true"
        ? `http://127.0.0.1:8888/`
        : `https://emss-labs.fit.nasa.gov/live/`;

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
          setPaneStateValue(dispatch, frameID, "ready", true);
        });
      }
    } else {
      // Fallback for Safari browser which supports HLS natively
      console.log("fallback for safari");
      try {
        videoRef.current.src = `${mtxHlsBaseUrl}${streamEndpointName}/index.m3u8`;
        videoRef.current.addEventListener("loadedmetadata", () => {
          videoRef.current.play();
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
    if (el.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  useEffect(() => {
    // is there an hls endpoint for this channel?
    let hlsForThisChannel = false;

    // loop through the hlsEndpointNames and look for this downlink channel
    for (const mtxHlsEndpointName of mtxHlsEndpointNames) {
      if (mtxHlsEndpointName.includes(downlinkNumber)) {
        hlsForThisChannel = true;
      }
    }
    setHlsAvailable(hlsForThisChannel);
  }, [mtxHlsEndpointNames]);

  useEffect(prepareHlsPlayer, [mtxHlsEndpointNames, videoRef.current, paneStateData]);
  useEffect(syncToPlayhead, [hlsRef.current, playhead.seconds]);
  useEffect(playOrPause, [playhead.isRunning, playhead.seconds]);

  return (
    <div key={`video_element__${frameID}`} className={styles.vidContainer}>
      {!hlsAvailable ? <div className={styles.playerPosterNovid}></div> : null}
      <video
        muted
        ref={videoRef}
        className={styles.player}
        onError={(e) => {
          const vidElement = e.target as HTMLVideoElement;
          if (!vidElement.error.message.includes("mpty")) {
            console.error(
              `video ${frameID} has thrown an error ${vidElement.error.code} - ${vidElement.error.message}`
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
          setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
        }}
      >
        <div>
          <p>
            Streams live video from an EMSS livestream recorder, synced to CODA's playback time.
            Video only temporarily available for playback and is deleted as time progresses.
          </p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default VideoHlsPane;
