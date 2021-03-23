import isNull from "lodash/isNull";
import deepEqual from "lodash/isEqual";
import { useRouter } from "next/router";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { PlayheadState, isSameDate } from "store/playhead";
import {
  buffering,
  setVideoDownlink,
  pickVideoFile,
  ready,
  selectVideoActivity,
  VideoActivity,
  VideosState,
  videoSelectors,
} from "store/videos";
import type { VideoFile } from "services/io";
import { hhmmssFromSeconds } from "utils/formatting";
import styles from "./video.module.css";
import { RootState } from "store/index";

/**
 * Check whether the error is the browser blocking autoplay of unmuted videos. See https://developers.google.com/web/updates/2017/09/autoplay-policy-changes
 */
const isAutoplayError = (e: Error): boolean => {
  // every browser displays a different error message
  const chrome_autoplay_error = /play\(\) failed because the user didn't interact with the document first/i;
  const firefox_autoplay_error = /The play method is not allowed by the user agent or the platform in the current context, possibly because the user denied permission/i;
  const safari_autoplay_error = /The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission/i;

  const isChromeError = !isNull(e.toString().match(chrome_autoplay_error));
  const isFirefoxError = !isNull(e.toString().match(firefox_autoplay_error));
  const isSafariError = !isNull(e.toString().match(safari_autoplay_error));

  return isChromeError || isFirefoxError || isSafariError;
};

/**
 * Renders a video and the downlink buttons
 */
export default function Videos({ playerID }: { playerID: number }) {
  const { query } = useRouter();
  const dispatch = useDispatch();
  const { videos, playhead }: { videos: VideosState; playhead: PlayheadState } = useSelector(
    (state: RootState) => state,
    deepEqual
  );
  const storeState = useStore().getState();
  const videoFiles: VideoFile[] = videoSelectors.selectAll(storeState);

  const videoElement = useRef() as MutableRefObject<HTMLVideoElement>;
  const [muted, setMuted] = useState(playerID !== 1);
  const [mutedDisplay, setMutedDisplay] = useState(playerID !== 1);
  const [metadata, setMetadata] = useState(null);
  const [status, setStatus] = useState(null);
  const [sourceURL, setSourceURL] = useState("");

  const [infoToggle, setInfoToggle] = useState(false);
  const [infoHover, setInfoHover] = useState(false);

  let videoActivity = null as VideoActivity;

  if (videoFiles.length > 0) {
    videoActivity = selectVideoActivity(storeState);
  }

  const getInitialDownlink = () => {
    const queryParam = query[`video${playerID}`];
    const downlink = (+queryParam || playerID) - 1;
    if (videos.downlinks[playerID] !== downlink) {
      dispatch(setVideoDownlink({ playerID, downlink }));
    }
  };

  const clearMetadata = () => {
    if (videoFiles.length === 0) {
      return;
    }
    const videoID = videos.activeVideoFiles[playerID];
    const videoStart = videoFiles[videoID]?.start || 0;
    if (videoID || !isSameDate(new Date(playhead.date), new Date(videoStart))) {
      setMetadata(null);
    }
  };

  const changeVideoFile = () => {
    // we can't update videos if we don't have videos
    if (!videoActivity) {
      return;
    }

    const group = videos.downlinks[playerID];
    const activeVideoFileID = videos.activeVideoFiles[playerID];
    const videosNextSecond = videoActivity[group][playhead.seconds + 1];

    // check for video changes
    let videoID = activeVideoFileID;

    // if the timeline just jumped or the video files changed, make sure we start the right video
    // we always use element 0 of the videos available in this group for any given second (see store/videos.ts)
    if (videosNextSecond.length > 0 && activeVideoFileID !== videosNextSecond[0]) {
      // there is a different video for this group the next second! pick the highest priority video for this group. See store/videos.ts#videoSorter for how video files are sorted
      videoID = videosNextSecond[0];
    }

    if (videosNextSecond.length === 0) {
      // check if no video is playing next second
      videoID = "";
    }

    // if the video source needs to change, change it
    if (videoID !== activeVideoFileID) {
      dispatch(pickVideoFile({ playerID, videoID }));

      // wipe out the metadata for this videoElement so that aspect will be recalculated when the next video loads
      setMetadata(null);
    }
  };

  const syncToplayhead = () => {
    // This stops one buffering video from essentially blocking beginning to buffer the other video
    if (!playhead.isRunning) {
      return;
    }

    // we can't update videos if we don't have videos
    if (!videoActivity) {
      return;
    }

    // bail if no video element is loaded
    if (!videoElement.current) {
      return;
    }

    const { currentTime } = videoElement.current;

    // make sure the video times are correct

    const currentlyPlayingVideo = videoSelectors.selectById(
      storeState,
      videos.activeVideoFiles[playerID]
    );
    let videoStartOffset = 0;
    if (currentlyPlayingVideo) {
      videoStartOffset = playhead.seconds - currentlyPlayingVideo.missionSecondsStart;
    }

    if (Math.abs(currentTime - videoStartOffset) > 1) {
      videoElement.current.currentTime = videoStartOffset;
    }
  };

  const playOrPause = () => {
    const videoID = videos.activeVideoFiles[playerID];
    if (videoID !== "") {
      const video = videoSelectors.selectById(storeState, videoID);
      // mute videos that were recorded during LOS because they contain the audio from the downlink time, not the time of recording
      if (video.className === "downlink-LOS") {
        setMuted(true);
      } else {
        if (!mutedDisplay) {
          try {
            setMuted(false);
          } catch (e) {
            if (isAutoplayError(e)) {
              // the browser is preventing autoplay of unmuted videos. so let's just mute the video. on the next playhead tick, we'll try to play again
              setMuted(true);
              setMutedDisplay(true);
            }
          }
        }
      }
    }
    (async () => {
      try {
        if (playhead.isRunning) {
          // make sure the video is playing when the playhead is running
          // if the video source is "", trying to play will "unload" the video and we'll show a poster instead
          await videoElement.current.play();
        } else if (!playhead.isRunning) {
          // make sure the video is paused when the playhead isn't running
          await videoElement.current.pause();
        }
      } catch (e) {
        if (isAutoplayError(e)) {
          // the browser is preventing autoplay of unmuted videos. so let's just mute the video. on the next playhead tick, we'll try to play again
          setMuted(true);
          setMutedDisplay(true);
        }
      }
    })();
  };

  const updateSourceInfo = () => {
    const videoID = videos.activeVideoFiles[playerID];

    if (videoID !== "") {
      // there is a video for this downlink
      const video = videoSelectors.selectById(storeState, videoID);
      setSourceURL(video.videoURL);
    } else {
      // there is no video for this downlink
      // clear out the video player
      setSourceURL("");

      // don't block the playhead
      if (!videos.ready[playerID]) {
        dispatch(ready(playerID));
      }
    }
  };

  const toggleFullScreen = () => {
    var el = videoElement.current;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  useEffect(changeVideoFile, [playhead.seconds, videoFiles, videos.downlinks[playerID]]);
  useEffect(clearMetadata, [playhead.date, videos.activeVideoFiles[playerID], videoFiles]);
  useEffect(getInitialDownlink, [query]);
  useEffect(playOrPause, [playhead.isRunning, playhead.seconds, sourceURL]);
  useEffect(syncToplayhead, [playhead.seconds, videos.activeVideoFiles[playerID]]);
  useEffect(updateSourceInfo, [videos.activeVideoFiles[playerID]]);

  /**
   * Renders the actual HTML5 video
   */
  const renderVideoElement = () => {
    // Displays video background poster to depect novid, buffering,
    // or blank if video loaded or buffering during playback
    // metadata used to determine whether a buffering event is happening on an already playing video
    // or a new loading event
    let posterClass = styles.playerPosterNovid;
    // hide noVid poster if video metadata has been loaded
    if (metadata) {
      posterClass = "";
    }
    if (status === "buffering") {
      // if there is no metadata then this is the buffering of a new video. Show loader.
      if (!metadata) {
        posterClass = styles.playerPosterBuffering;
      } else {
        posterClass = "";
      }
    }

    // show IO error if a 400 error has been raised in the video player event handlers below
    let IOErrorCSS = {};
    if (status === "error" && sourceURL !== "") {
      IOErrorCSS = { display: "block" };
    }

    return (
      <div
        key={`video_element__${playerID}`}
        className={`${styles.vidContainer} ${styles.vidContainer4by3}`}
      >
        <div className={`${styles.playerPoster} ${posterClass}`}>
          <div className={styles.IOError} style={IOErrorCSS}>
            Imagery Online Video Error
          </div>
        </div>
        <video
          ref={videoElement}
          className={styles.player}
          src={sourceURL}
          muted={muted}
          onCanPlay={() => {
            if (!videos.ready[playerID]) {
              dispatch(ready(playerID));
            }
          }}
          onEnded={() => {
            // ready up because we don't want a missing video to hold up the playhead
            dispatch(ready(playerID));
          }}
          onWaiting={() => {
            if (videos.ready[playerID] && sourceURL !== "") {
              dispatch(buffering(playerID));
              setStatus("buffering");
            }
          }}
          onPlaying={() => {
            setStatus("playing");
          }}
          onLoadedMetadata={(e) => {
            // Used to later determine whether a buffering event is happening on an already playing video
            // or a new loading event
            const vidElement = e.target as HTMLVideoElement;
            const metaData = {
              videoHeight: vidElement.videoHeight,
              videoWidth: vidElement.videoWidth,
              duration: vidElement.duration,
            };
            setMetadata(metaData);
          }}
          onClick={() => {
            if (currentlyPlayingVideo) {
              toggleFullScreen();
            }
          }}
          onError={(e) => {
            const vidElement = e.target as HTMLVideoElement;
            if (!vidElement.error.message.includes("mpty")) {
              //if not 'src attribute is empty' - this eliminates raising an IO error on empty src
              setStatus("error");
              console.error(
                `video ${playerID} has thrown an error ${vidElement.error.code} - ${vidElement.error.message}`
              );
            } else {
              setStatus("novid");
            }
            //unblocking playhead
            if (videos.ready[playerID] !== true) {
              dispatch(ready(playerID));
            }
          }}
        />
        {renderVideoOverlay()}
      </div>
    );
  };

  const renderButtons = () => {
    const group = videos.downlinks[playerID];
    const availableGroups = [0, 1, 2, 3, 4, 5, 6];

    return availableGroups.map((g) => {
      let buttonClassStyle = styles.vidButton;
      if (g === group) {
        buttonClassStyle = `${buttonClassStyle} ${styles.selected}`;
      } else if (videoActivity && videoActivity[g][playhead.seconds].length > 0) {
        buttonClassStyle = `${buttonClassStyle} ${styles.active}`;
      }
      return (
        <button
          key={`vid${playerID}__button${g}`}
          type="button"
          title={g < 6 ? `Select downlink ${g + 1}` : "Select other video"}
          className={buttonClassStyle}
          onClick={() => {
            if (g !== group) {
              dispatch(setVideoDownlink({ playerID, downlink: g }));
              setInfoToggle(false);
            }
          }}
        >
          {g < 6 ? `${g + 1}` : "~7"}
        </button>
      );
    });
  };

  const renderVideoOverlay = () => {
    const currentlyPlayingVideo = videoSelectors.selectById(
      storeState,
      videos.activeVideoFiles[playerID]
    );
    let videoStartOffset = 0;
    let ioSearchLink = "";
    let ioVideoURL = "";
    let openVideoURLMessage = "";
    let videoFilename = "";
    let dateAdded = "";
    let openOnIOMessage = "";
    let info = "";
    let infoDisplayClass = "";
    if (currentlyPlayingVideo) {
      videoStartOffset = playhead.seconds - currentlyPlayingVideo.missionSecondsStart;
      videoFilename = currentlyPlayingVideo.id;
      ioSearchLink = currentlyPlayingVideo.url;
      ioVideoURL = `${currentlyPlayingVideo.videoURL}#t=${videoStartOffset}`;
      openVideoURLMessage = `Open video file directly at ${hhmmssFromSeconds(videoStartOffset)}`;
      openOnIOMessage = `Open on IO`;
      dateAdded = new Date(currentlyPlayingVideo.md_creation_date).toUTCString();
      info = currentlyPlayingVideo.description;
    }
    if (infoHover || infoToggle) {
      infoDisplayClass = styles.photoOverlayVisible;
    }

    return (
      <div className={`${styles.vidOverlay} ${infoDisplayClass}`}>
        <div className={styles.overlayTable}>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>Date Added</div>
            <div className={`${styles.overlayTableCell}`}>{dateAdded}</div>
          </div>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>IO Asset Name</div>
            <div className={styles.overlayTableCell}>
              <a href={ioSearchLink} target="_blank" style={{ fontSize: "0.9em" }}>
                {openOnIOMessage}
              </a>
              <div className={styles.digiValue}>{videoFilename}</div>
            </div>
          </div>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>Video URL</div>
            <div className={styles.overlayTableCell}>
              <a href={ioVideoURL} target="_blank" style={{ fontSize: "0.9em" }}>
                {openVideoURLMessage}
              </a>
              <br />
              <span className={styles.digiValue} style={{ fontSize: "0.9em", color: "#BBBBBB" }}>
                {ioVideoURL}
              </span>
            </div>
          </div>
          <div className={styles.overlayTableRow}>
            <div className={`${styles.overlayTableCell} ${styles.titleRow}`}>IO Description</div>
            <div className={styles.overlayTableCell}>{info}</div>
          </div>
        </div>
      </div>
    );
  };

  const mutedOutlineClass = mutedDisplay === true ? styles.unmute : styles.mute;

  const currentlyPlayingVideo = videoSelectors.selectById(
    storeState,
    videos.activeVideoFiles[playerID]
  );
  let infoButtonStyle = "";
  if (currentlyPlayingVideo) {
    infoButtonStyle = styles.infoActive;
  }
  if (infoToggle) {
    infoButtonStyle = styles.infoSelected;
  }
  return (
    <div className={styles.mediaPanel} key={`video_player__${playerID}`}>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <div
          className={`${styles.infoButton} ${infoButtonStyle}`}
          title={`Click to toggle IO info`}
          onMouseEnter={() => {
            setInfoHover(currentlyPlayingVideo ? true : false);
          }}
          onMouseLeave={() => {
            setInfoHover(false);
          }}
          onClick={() => {
            setInfoToggle(!infoToggle);
          }}
        >
          <div className={styles.infoText}>IO</div> <div className={styles.infoIcon}></div>
        </div>
        {renderButtons()}
        <div
          className={`${styles.soundBtnOutline} ${mutedOutlineClass}`}
          title={`Click to mute/unmute`}
          onClick={() => {
            setMutedDisplay(!mutedDisplay);
          }}
        ></div>
      </div>
      {renderVideoElement()}
    </div>
  );
}
