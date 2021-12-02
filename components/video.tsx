import isNull from "lodash/isNull";
import isNil from "lodash/isNil";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { PlayheadState, isSameDate, midnightZulu } from "store/playhead";
import {
  buffering,
  setVideoDownlink,
  setVideoNonDownlinkID,
  setActiveVideoFile,
  ready,
  videoSelectors,
  VideosEntityState,
  visibleVideosBySecond,
} from "store/videos";
import { hhmmssFromSeconds } from "utils/formatting";
import styles from "./video.module.css";
import { RootState } from "store/index";
import type { QueryParams } from "pages/view/iss";
import { Collection, VideoFile } from "typings";
import { cleanCollectionsString } from "utils/formatting";

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
export default function Video(props: {
  frameID: number;
  collection: Collection;
  query: QueryParams;
}) {
  const frameID = props.frameID;
  const query: QueryParams = props.query;

  const dispatch = useDispatch();

  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const playheadDate = new Date(playhead.date);
  const startOfDay = playheadDate.valueOf() / 1000;

  const videoFiles: VideoFile[] = videoSelectors.selectAll(videos);
  const visibleVideos = visibleVideosBySecond(videoFiles, playheadDate);

  const videoElement = useRef() as MutableRefObject<HTMLVideoElement>;
  const [muted, setMuted] = useState(frameID !== 1);
  const [metadata, setMetadata] = useState(null);
  const [status, setStatus] = useState(null);
  const [sourceURL, setSourceURL] = useState("");

  const [infoToggle, setInfoToggle] = useState(false);
  const [infoHover, setInfoHover] = useState(false);

  const getInitialDownlink = () => {
    const dlParam = query[`video${frameID}`];
    const downlink = (+dlParam || frameID) - 1;

    //set nonDownlinkVideo selected if non-downlink video has been selected
    const nonDLParam = query[`nonDLvideo${frameID}`] as string;
    if (downlink === 6) {
      dispatch(setVideoNonDownlinkID({ frameID, nonDownlinkID: nonDLParam }));
    }

    if (videos.downlinks[frameID] !== downlink) {
      dispatch(setVideoDownlink({ frameID, downlink }));
    }
  };

  const clearMetadata = () => {
    if (visibleVideos.size === 0) {
      return;
    }
    const videoID = videos.activeVideoFiles[frameID];
    const videoStart = videoFiles[videoID]?.start || 0;
    if (videoID || !isSameDate(new Date(playhead.date), new Date(videoStart))) {
      setMetadata(null);
    }
  };

  const changeVideoFile = () => {
    // we can't update videos if we don't have videos
    if (visibleVideos.size === 0) {
      return;
    }

    const downlink = videos.downlinks[frameID];
    const activeVideoFileID = videos.activeVideoFiles[frameID];
    const videosNextSecond = visibleVideos.get(`${playhead.seconds + 1}/${downlink}`);

    // check for video changes
    let videoID = activeVideoFileID;

    // if the timeline just jumped or the video files changed, make sure we start the right video
    // we always use element 0 of the videos available in this downlink for any given second (see store/videos.ts)
    if (videosNextSecond && activeVideoFileID !== videosNextSecond[0]) {
      // there is a different video for this downlink the next second! pick the highest priority video for this downlink. See store/videos.ts#videoSorter for how video files are sorted
      videoID = videosNextSecond[0];
    }

    if (!videosNextSecond) {
      // clear the player if no video is playing next second
      videoID = "";
    }

    if (downlink === 6) {
      videoID = videos.nonDownlinkIDs[frameID];
      if (videosNextSecond && !videosNextSecond.includes(videoID)) {
        videoID = videosNextSecond[0];
        dispatch(setVideoNonDownlinkID({ frameID, nonDownlinkID: videoID }));
      }
      if (videosNextSecond && videosNextSecond.length === 0 && videoID !== "") {
        dispatch(setVideoNonDownlinkID({ frameID, nonDownlinkID: "" }));
      }
    }

    // if the video source needs to change, change it
    if (videoID !== activeVideoFileID) {
      dispatch(setActiveVideoFile({ frameID, videoID }));

      // wipe out the metadata for this videoElement so that aspect will be recalculated when the next video loads
      setMetadata(null);
    }
  };

  const syncToPlayhead = () => {
    // we can't update videos if we don't have videos
    if (visibleVideos.size === 0) {
      return;
    }

    // bail if no video element is loaded
    if (!videoElement.current) {
      return;
    }

    const { currentTime } = videoElement.current;

    // make sure the video times are correct

    const currentlyPlayingVideo = videoSelectors.selectById(
      videos,
      videos.activeVideoFiles[frameID]
    );
    let videoStartOffset = 0;
    if (currentlyPlayingVideo) {
      videoStartOffset = playhead.seconds - (currentlyPlayingVideo.start - startOfDay);
    }

    if (Math.abs(currentTime - videoStartOffset) > 1) {
      videoElement.current.currentTime = videoStartOffset;
    }
  };

  const playOrPause = () => {
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
        }
      }
    })();
  };

  const updateSourceInfo = () => {
    const videoID = videos.activeVideoFiles[frameID];

    if (videoID !== "" && videoID !== undefined) {
      // there is a video for this downlink
      const currentlyPlayingVideo = videoSelectors.selectById(videos, videoID);
      setSourceURL(currentlyPlayingVideo.mediaLowResURL);
    } else {
      // there is no video for this downlink
      // clear out the video player
      setSourceURL("");

      // don't block the playhead
      if (!videos.ready[frameID]) {
        dispatch(ready(frameID));
      }
    }
  };

  const toggleFullScreen = () => {
    var el = videoElement.current;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  const cueVideoToPlayhead = () => {
    // cue the new video to the right start time to avoid buffering the beginning of the video needlessly
    if (sourceURL !== "") {
      const currentlyPlayingVideo = videoSelectors.selectById(
        videos,
        videos.activeVideoFiles[frameID]
      );

      if (isNil(currentlyPlayingVideo)) {
        return;
      }

      const videoStartOffset = playhead.seconds - (currentlyPlayingVideo.start - startOfDay);
      videoElement.current.currentTime = videoStartOffset;
    }
  };

  useEffect(changeVideoFile, [playhead.seconds, videoFiles, videos.downlinks[frameID]]);
  useEffect(clearMetadata, [playhead.date, videos.activeVideoFiles[frameID], videoFiles]);
  useEffect(getInitialDownlink, [query]);
  useEffect(playOrPause, [playhead.isRunning, playhead.seconds, sourceURL]);
  useEffect(syncToPlayhead, [playhead.seconds, videos.activeVideoFiles[frameID]]);
  useEffect(updateSourceInfo, [videos.activeVideoFiles[frameID]]);
  useEffect(cueVideoToPlayhead, [sourceURL]);

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
    if (metadata || status === "playing") {
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

    const videoID = videos.activeVideoFiles[frameID];
    let video: VideoFile;
    if (videoID !== "") {
      video = videoSelectors.selectById(videos, videoID);
    }

    const ioError = status === "error" && sourceURL !== "";
    const startDate = !isNil(video) ? new Date(video.start * 1000) : null;
    // assume the video is not time synced if it starts at 00:00:00 UTC
    const isNotTimeSynced =
      !isNil(video) && startDate && startDate.valueOf() === midnightZulu(startDate).valueOf();

    // show IO error if a 400 error has been raised in the video player event handlers below
    let ioErrorCSS = {};
    let ioErrorMessage = "";
    if (ioError) {
      ioErrorCSS = { display: "block" };
      ioErrorMessage = "Imagery Online Video Error";
    }

    // show error if the video is (very likely) not time synced
    if (isNotTimeSynced) {
      ioErrorCSS = { display: "block", zIndex: 1 };
      ioErrorMessage = "IO Video Not Time Synced";
    }

    // the audio in LOS downlinked videos is never synced to the video
    const isLOSVideo = !isNil(video) && video.LOS;
    const shouldMute = muted || isLOSVideo;

    return (
      <div
        key={`video_element__${frameID}`}
        className={`${styles.vidContainer} ${styles.vidContainer4by3}`}
      >
        <div className={`${styles.playerPoster} ${posterClass}`}>
          <video
            ref={videoElement}
            className={styles.player}
            src={sourceURL}
            muted={shouldMute}
            onCanPlay={() => {
              if (!videos.ready[frameID]) {
                dispatch(ready(frameID));
              }
            }}
            onEnded={() => {
              // ready up because we don't want a missing video to hold up the playhead
              dispatch(ready(frameID));
            }}
            onWaiting={() => {
              if (videos.ready[frameID] && sourceURL !== "") {
                dispatch(buffering(frameID));
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
                  `video ${frameID} has thrown an error ${vidElement.error.code} - ${vidElement.error.message}`
                );
              } else {
                setStatus("novid");
              }
              //unblocking playhead
              if (videos.ready[frameID] !== true) {
                dispatch(ready(frameID));
              }
            }}
          />
          <div className={styles.IOError} style={ioErrorCSS}>
            {ioErrorMessage}
          </div>
        </div>
        {renderVideoOverlay()}
      </div>
    );
  };

  const renderButtons = () => {
    const downlink = videos.downlinks[frameID];
    const availableDownlinks = [0, 1, 2, 3, 4, 5];

    return availableDownlinks.map((d) => {
      let buttonClassStyle = styles.vidButton;
      if (d === downlink) {
        buttonClassStyle = `${styles.vidButton} ${styles.selected}`;
      } else if (visibleVideos && visibleVideos.get(`${playhead.seconds}/${d}`)) {
        buttonClassStyle = `${styles.vidButton} ${styles.active}`;
      }
      return (
        <button
          key={`vid${frameID}__button${d}`}
          type="button"
          title={`Select downlink ${d + 1}`}
          className={buttonClassStyle}
          onClick={() => {
            if (d !== downlink) {
              dispatch(setVideoDownlink({ frameID, downlink: d }));
              dispatch(setVideoNonDownlinkID({ frameID, nonDownlinkID: "" }));
              setInfoToggle(false);
            }
          }}
        >
          {d + 1}
        </button>
      );
    });
  };

  const getPrettyVideoTitle = (videoID: string) => {
    const video = videoSelectors.selectById(videos, videoID);
    if (video) {
      if (video.title && video.title.trim() !== "") {
        return video.title;
      }
      return cleanCollectionsString(video.collections) + " - " + videoID;
    }
    return "";
  };

  const renderNonDl = () => {
    const nonDlVideoIDs = visibleVideos.get(`${playhead.seconds}/6`) || [];

    const optionList = () => {
      if (nonDlVideoIDs.length === 0) {
        return;
      }

      return nonDlVideoIDs.map((v) => {
        return (
          <option value={v} key={v}>
            {getPrettyVideoTitle(v)}
          </option>
        );
      });
    };

    let buttonClassStyle = styles.vidButton;
    let arrowClass = styles.select_arrow;
    if (videos.downlinks[frameID] === 6) {
      buttonClassStyle = `${styles.vidButton} ${styles.selected}`;
      arrowClass = styles.select_arrow_dark;
    } else if (nonDlVideoIDs.length > 0) {
      buttonClassStyle = `${styles.vidButton} ${styles.active}`;
    }

    let selectActiveStyle = "";
    if (nonDlVideoIDs.length > 0) {
      selectActiveStyle = styles.selectActive;
    }
    return (
      <>
        <div
          className={styles.selectContainer}
          title={getPrettyVideoTitle(videos.nonDownlinkIDs[frameID])}
        >
          <select
            className={`${buttonClassStyle} ${styles.nonDLButton} ${styles.selectNonDL} ${selectActiveStyle}`}
            value={videos.nonDownlinkIDs[frameID]}
            onChange={(e) => {
              dispatch(setVideoDownlink({ frameID, downlink: 6 }));
              dispatch(setVideoNonDownlinkID({ frameID, nonDownlinkID: e.target.value }));
              setInfoToggle(false);
            }}
          >
            <option disabled value="">
              {props.collection === Collection.ISS ? "Non-D/L" : "Other video"}
            </option>
            {optionList()}
          </select>
          <div className={arrowClass}></div>
        </div>
      </>
    );
  };

  const renderVideoOverlay = () => {
    const currentlyPlayingVideo = videoSelectors.selectById(
      videos,
      videos.activeVideoFiles[frameID]
    );
    let videoStartOffset = 0;
    let ioSearchLink = "";
    let ioVideoURL = "";
    let openVideoURLMessage = "";
    let videoFilename = "";
    let startDateTime = "";
    let openOnIOMessage = "";
    let info = "";
    let infoDisplayClass = "";
    if (currentlyPlayingVideo) {
      videoStartOffset = playhead.seconds - Math.max(currentlyPlayingVideo.start - startOfDay, 0);
      videoFilename = currentlyPlayingVideo.id;
      ioSearchLink = currentlyPlayingVideo.dataURL;
      ioVideoURL = `${currentlyPlayingVideo.mediaLowResURL}#t=${videoStartOffset}`;
      openVideoURLMessage = `Open video file directly at ${hhmmssFromSeconds(videoStartOffset)}`;
      openOnIOMessage = `Open on IO`;
      startDateTime = new Date(currentlyPlayingVideo.startDateTime).toUTCString();
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
            <div className={`${styles.overlayTableCell}`}>{startDateTime}</div>
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

  const mutedOutlineClass = muted === true ? styles.unmute : styles.mute;

  const currentlyPlayingVideo = videoSelectors.selectById(videos, videos.activeVideoFiles[frameID]);
  let infoButtonStyle = "";
  if (currentlyPlayingVideo) {
    infoButtonStyle = styles.infoActive;
  }
  if (infoToggle) {
    infoButtonStyle = styles.infoSelected;
  }
  return (
    <div className={styles.mediaPanel} key={`video_player__${frameID}`}>
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
        {renderNonDl()}
        <div
          className={`${styles.soundBtnOutline} ${mutedOutlineClass}`}
          title={`Click to mute/unmute`}
          onClick={() => {
            setMuted(!muted);
          }}
        ></div>
      </div>
      {renderVideoElement()}
    </div>
  );
}
