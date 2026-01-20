import isNil from "lodash/isNil";
import { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAutoplayError } from "utils/video";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { visibleVideosBySecond } from "utils/video";
import { hhmmssFromSeconds } from "utils/formatting";
import styles from "./video-player-io.module.css";
import { setPaneStateDataValue } from "store/framework";
import HelpOverlay from "components/interface/pane-help-overlay";
import { isSameDate, midnightZulu } from "../../../utils/date";
import { VideoPoster, getPosterState } from "./video-poster";
import { VideoIOHelpContent } from "./video-help";
import ClockInterval from "components/framework/ClockInterval";

// ============================================================================
// IO Video Player Component
// ============================================================================

/**
 * Determines if a video is likely not time-synced.
 * Videos starting exactly at midnight UTC are assumed to have incorrect time data.
 */
const isVideoNotTimeSynced = (video: VideoFile | undefined): boolean => {
  if (isNil(video)) return false;
  const startDate = new Date(video.start * 1000);
  return startDate.valueOf() === midnightZulu(startDate).valueOf();
};

/**
 * Determines if the video should be muted.
 * - Explicitly muted by user
 * - LOS (Loss of Signal) videos always have desynced audio
 */
const shouldMuteVideo = (
  paneStateData: VideoPaneStateData,
  video: VideoFile | undefined
): boolean => {
  const isLOSVideo = !isNil(video) && video.LOS;
  return paneStateData.muted || isLOSVideo;
};

export const VideoIOPane: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const dispatch = useAppDispatch();

  const videos = useAppSelector((state) => state.videos, deepEqual);
  const playheadDate = useAppSelector((state) => state.clock.date, refEqual);
  const isRunning = useAppSelector((state) => state.clock.isRunning, refEqual);
  const paneStateData = useAppSelector(
    (state) => state.framework.frames[frameID].paneStateData as VideoPaneStateData,
    deepEqual
  );

  const [appSeconds, setLocalAppSeconds] = useState(0);

  // Handle race condition where playheadDate might be null on initial render
  // Use today's date as fallback - memoized to avoid impure function during render
  const todayFallback = useMemo(() => new Date().toISOString().split("T")[0], []);
  const effectivePlayheadDate = playheadDate || todayFallback;
  const playheadDateObj = new Date(effectivePlayheadDate);
  const startOfDay = playheadDateObj.valueOf() / 1000;

  const videoFiles = videos.videoFiles;
  const visibleVideos = visibleVideosBySecond(videoFiles, playheadDateObj);

  const videoElement = useRef<HTMLVideoElement | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [status, setStatus] = useState<VideoStatus>(null);
  const [sourceURL, setSourceURL] = useState<string | null>(null);

  // ============================================================================
  // Video Selection Logic
  // ============================================================================

  /**
   * Find the appropriate video for the current channel and time.
   */
  const findCurrentVideoID = useCallback((): string => {
    const { channel, activeVideoFileID } = paneStateData;
    const videosThisSecond = visibleVideos.get(`${appSeconds}/${channel}`);

    if (channel === -1) {
      // Non-downlink video: keep current video only if it's valid this second
      if (activeVideoFileID && videosThisSecond?.includes(activeVideoFileID)) {
        return activeVideoFileID;
      }
      return "";
    }

    // Downlink channel: use highest priority video available this second
    return videosThisSecond?.[0] ?? "";
  }, [paneStateData, appSeconds, visibleVideos]);

  const getCurrentVideo = useCallback((): VideoFile | undefined => {
    return videoFiles.find((v) => v.id === paneStateData.activeVideoFileID);
  }, [videoFiles, paneStateData.activeVideoFileID]);

  const getVideoOffset = useCallback(
    (video: VideoFile): number => {
      return appSeconds - (video.start - startOfDay);
    },
    [appSeconds, startOfDay]
  );

  // ============================================================================
  // Effects
  // ============================================================================

  // Update active video file when playhead moves or videos change
  useEffect(() => {
    const currVideoID = findCurrentVideoID();
    if (currVideoID !== paneStateData.activeVideoFileID) {
      dispatch(
        setPaneStateDataValue({
          frameID,
          paneStateProperty: "activeVideoFileID",
          paneStateValue: currVideoID,
        })
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing metadata when video changes is a legitimate side effect
      setMetadata(null);
    }
  }, [findCurrentVideoID, paneStateData.activeVideoFileID, dispatch, frameID]);

  // Clear metadata when date changes
  useEffect(() => {
    if (visibleVideos.size === 0) return;
    const videoID = Number(paneStateData.activeVideoFileID);
    const videoStart = videoFiles[videoID]?.start || 0;
    if (videoID || !isSameDate(new Date(playheadDate || ""), new Date(videoStart))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing metadata on date change is a legitimate side effect
      setMetadata(null);
    }
  }, [playheadDate, paneStateData.activeVideoFileID, videoFiles, visibleVideos]);

  // Handle play/pause based on playhead state
  useEffect(() => {
    const asyncFunc = async () => {
      const video = videoElement.current;
      if (!video) return;

      try {
        if (isRunning) {
          await video.play();
        } else {
          await video.pause();
        }
      } catch (e: unknown) {
        if (isAutoplayError(e)) {
          // Browser blocking autoplay of unmuted videos - mute and retry
          dispatch(
            setPaneStateDataValue({
              frameID,
              paneStateProperty: "muted",
              paneStateValue: true,
            })
          );
        }
      }
    };
    asyncFunc();
  }, [isRunning, appSeconds, sourceURL, dispatch, frameID]);

  // Sync video time to playhead
  useEffect(() => {
    const video = videoElement.current;
    if (!video || !paneStateData.activeVideoFileID || !sourceURL) return;

    const currentVideo = getCurrentVideo();
    if (!currentVideo) return;

    const videoStartOffset = getVideoOffset(currentVideo);
    const videoDuration = currentVideo.end - currentVideo.start;

    // Don't sync if playhead is outside video's time range
    if (videoStartOffset < 0 || videoStartOffset > videoDuration) return;

    // Only seek if drift is greater than 1 second
    if (Math.abs(video.currentTime - videoStartOffset) > 1) {
      video.currentTime = videoStartOffset;
    }
  }, [appSeconds, paneStateData.activeVideoFileID, sourceURL, getCurrentVideo, getVideoOffset]);

  // Update source URL when active video changes
  useEffect(() => {
    const { activeVideoFileID } = paneStateData;

    if (activeVideoFileID) {
      const currentVideo = getCurrentVideo();
      if (currentVideo) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- imperative video element control and state sync when active video changes
        setSourceURL(currentVideo.mediaLowResURL);
      }
    } else {
      // No video - properly unload the video element
      if (videoElement.current) {
        videoElement.current.pause();
        videoElement.current.removeAttribute("src");
        videoElement.current.load();
      }
      setSourceURL(null);
      setMetadata(null);
      setStatus(null);

      // Don't block the playhead
      if (!paneStateData.ready) {
        dispatch(
          setPaneStateDataValue({
            frameID,
            paneStateProperty: "ready",
            paneStateValue: true,
          })
        );
      }
    }
  }, [paneStateData, getCurrentVideo, dispatch, frameID]);

  // Cue video to correct time when source changes
  useEffect(() => {
    if (!sourceURL || !videoElement.current) return;

    const currentVideo = getCurrentVideo();
    if (!currentVideo) return;

    videoElement.current.currentTime = getVideoOffset(currentVideo);
  }, [sourceURL, getCurrentVideo, getVideoOffset]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleCanPlay = () => {
    if (!paneStateData.ready) {
      dispatch(
        setPaneStateDataValue({
          frameID,
          paneStateProperty: "ready",
          paneStateValue: true,
        })
      );
    }
  };

  const handleEnded = () => {
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: "ready",
        paneStateValue: true,
      })
    );
  };

  const handleWaiting = () => {
    if (paneStateData.ready && sourceURL) {
      dispatch(
        setPaneStateDataValue({
          frameID,
          paneStateProperty: "ready",
          paneStateValue: false,
        })
      );
      setStatus("buffering");
    }
  };

  const handlePlaying = () => {
    setStatus("playing");
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vidElement = e.target as HTMLVideoElement;
    setMetadata({
      videoHeight: vidElement.videoHeight,
      videoWidth: vidElement.videoWidth,
      duration: vidElement.duration,
    });
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vidElement = e.target as HTMLVideoElement;

    // Ignore "src attribute is empty" errors - these occur during normal cleanup
    if (!vidElement.error?.message.includes("mpty")) {
      setStatus("error");
      console.error(
        `video ${frameID} has thrown an error ${vidElement.error?.code} - ${vidElement.error?.message}`
      );
    } else {
      setStatus("novid");
    }

    // Unblock playhead on any error
    if (paneStateData.ready !== true) {
      dispatch(
        setPaneStateDataValue({
          frameID,
          paneStateProperty: "ready",
          paneStateValue: true,
        })
      );
    }
  };

  const handleVideoClick = () => {
    if (paneStateData.activeVideoFileID) {
      const el = videoElement.current;
      if (el?.requestFullscreen) {
        el.requestFullscreen();
      }
    }
  };

  const handleHelpClose = () => {
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: "showHelp",
        paneStateValue: !paneStateData.showHelp,
      })
    );
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const currentVideo = getCurrentVideo();
  const posterState = getPosterState(metadata, status);
  const hasError = status === "error" && sourceURL;
  const notTimeSynced = isVideoNotTimeSynced(currentVideo);

  const getErrorMessage = (): string => {
    if (notTimeSynced) return "Incorrect Time Data on Imagery Online";
    if (hasError) return "Imagery Online Video Error";
    return "";
  };

  const renderVideoOverlay = () => {
    if (!paneStateData.showInfo) return null;

    const videoStartOffset = currentVideo
      ? appSeconds - Math.max(currentVideo.start - startOfDay, 0)
      : 0;

    const overlayData = currentVideo
      ? {
          videoFilename: currentVideo.id,
          ioSearchLink: currentVideo.dataURL,
          ioVideoURL: `${currentVideo.mediaLowResURL}#t=${videoStartOffset}`,
          openVideoURLMessage: `Open video file directly at ${hhmmssFromSeconds(videoStartOffset)}`,
          title: currentVideo.title || "",
          startDateTime: new Date(currentVideo.startDateTime).toUTCString(),
          info: currentVideo.description,
        }
      : {
          videoFilename: "",
          ioSearchLink: "",
          ioVideoURL: "",
          openVideoURLMessage: "",
          title: "",
          startDateTime: "",
          info: "",
        };

    return (
      <div className={`${styles.vidOverlay} ${styles.videoOverlayVisible}`}>
        <table className={styles.overlayTable}>
          <tbody>
            <tr>
              <td>Title</td>
              <td>{overlayData.title}</td>
            </tr>
            <tr>
              <td>Date Added</td>
              <td>{overlayData.startDateTime}</td>
            </tr>
            <tr>
              <td>IO Asset Name</td>
              <td>
                <a
                  href={overlayData.ioSearchLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "0.9em" }}
                >
                  Open on IO
                </a>
                <div className={styles.digiValue}>{overlayData.videoFilename}</div>
              </td>
            </tr>
            <tr>
              <td>Video URL</td>
              <td>
                <a
                  href={overlayData.ioVideoURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "0.9em" }}
                >
                  {overlayData.openVideoURLMessage}
                </a>
                <br />
                <span className={styles.digiValue} style={{ fontSize: "0.9em", color: "#BBBBBB" }}>
                  {overlayData.ioVideoURL}
                </span>
              </td>
            </tr>
            <tr>
              <td>IO Description</td>
              <td>{overlayData.info}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const errorMessage = getErrorMessage();
  const errorStyle = errorMessage
    ? { display: "block", ...(notTimeSynced ? { zIndex: 1 } : {}) }
    : {};

  return (
    <div className={styles.mediaPanel} key={`video_player__${frameID}`} data-frame-id="IO Player">
      <ClockInterval setAppSeconds={setLocalAppSeconds} />
      <div key={`video_element__${frameID}`} className={styles.vidContainer}>
        <VideoPoster state={posterState} />

        <video
          ref={videoElement}
          className={styles.player}
          src={sourceURL || undefined}
          muted={shouldMuteVideo(paneStateData, currentVideo)}
          onCanPlay={handleCanPlay}
          onEnded={handleEnded}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleError}
          onClick={handleVideoClick}
        />

        <div className={styles.IOError} style={errorStyle}>
          {errorMessage}
        </div>

        {renderVideoOverlay()}

        <HelpOverlay isModalOpen={paneStateData.showHelp} closeHandler={handleHelpClose}>
          <VideoIOHelpContent />
        </HelpOverlay>
      </div>
    </div>
  );
};
