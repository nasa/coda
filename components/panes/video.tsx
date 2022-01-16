import { isNil, isNull } from "lodash";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faExpandAlt, faInfo, faVolumeUp, faVolumeMute } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "components/interface/button";
import type { RootState } from "store/index";
import { isSameDate, midnightZulu } from "store/playhead";
import { videoSelectors, visibleVideosBySecond } from "store/videos";
import { hhmmssFromSeconds } from "utils/formatting";
import styles from "./video.module.css";
import { ModalDropdown } from "../interface/dropdown-v2";
import { setPaneStateDataValue } from "store/framework";

library.add(faExpandAlt, faInfo, faVolumeUp, faVolumeMute);

export function IOInfoButton(props: { clickHandler; selected?: boolean }) {
  const selectedStyle = props.selected ? styles.selected : "";
  return (
    <button
      className={`${styles.ioButton} ${selectedStyle}`}
      onClick={() => {
        if (props.clickHandler) {
          props.clickHandler();
        }
      }}
    >
      <span className={styles.ioLabel}>
        IO{" "}
        <span style={{ fontSize: "8px", position: "relative", top: "-1px" }}>
          <FontAwesomeIcon icon="info" />
        </span>
      </span>
    </button>
  );
}

export function MuteButton(props: { clickHandler; muted: boolean }) {
  let icon;
  if (props.muted) {
    icon = <FontAwesomeIcon icon="volume-mute" />;
  } else {
    icon = <FontAwesomeIcon icon="volume-up" />;
  }

  return (
    <button
      className={styles.clearTextButton}
      onClick={() => {
        if (props.clickHandler) {
          props.clickHandler();
        }
      }}
    >
      {icon}
    </button>
  );
}

export function ExpandButton() {
  return (
    <button className={styles.clearTextButton}>
      <FontAwesomeIcon icon="expand-alt" />
    </button>
  );
}

const downlinks = [0, 1, 2, 3, 4, 5, 6, 7];

export function VideoControls(props: { frameID: number; frameWidth: number }) {
  const frameID = props.frameID;
  const dispatch = useDispatch();

  const minWidth = 440; // minimum width of the video pane before breaking into dropdown for downlinks

  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);
  const playheadDate = new Date(playhead.date);
  const videoFiles: VideoFile[] = videoSelectors.selectAll(videos);
  const visibleVideos = visibleVideosBySecond(videoFiles, playheadDate);

  const paneStateData: VideoDLPaneControlStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  function setPaneStateValue(propertyName, propertyValue) {
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: propertyName,
        paneStateValue: propertyValue,
      })
    );
  }

  const [downlinkAvailability, setDownlinkAvailability] = useState([]);

  useEffect(() => {
    if (visibleVideos.size === 0) {
      return;
    }
    const downlinkAvailability = [];
    for (const downlink in downlinks) {
      const videosNextSecond = visibleVideos.get(`${playhead.seconds + 1}/${downlink}`);
      downlinkAvailability.push(isNil(videosNextSecond) ? false : true);
    }
    setDownlinkAvailability(downlinkAvailability);
  }, [visibleVideos, playhead.seconds]);

  if (props.frameWidth > minWidth) {
    return (
      <div className={styles.controls}>
        <div className={styles.selections}>
          {downlinks.map((d) => {
            let rounded = "none";
            if (d === 1) {
              rounded = "left";
            } else if (d === 8) {
              rounded = "right";
            }

            let color = "disabled";
            if (downlinkAvailability[d]) {
              color = "active";
            }
            if (paneStateData.downlink === d) {
              color = "selected";
            }

            return (
              <Button
                key={"DLBUTTON_" + d + "_" + frameID}
                color={color}
                size="small"
                rounded={rounded}
                callback={() => {
                  setPaneStateValue("downlink", d);
                }}
              >
                <div className={styles.dlLabel}>{d + 1}</div>
              </Button>
            );
          })}
        </div>
        <div className={styles.rightButtons}>
          <div className={styles.verticalCenter}>
            <IOInfoButton
              clickHandler={() => {
                setPaneStateValue("showInfo", !paneStateData.showInfo);
              }}
              selected={paneStateData.showInfo}
            />
          </div>
          <div className={styles.verticalCenter} style={{ width: "30px" }}>
            <MuteButton
              clickHandler={() => {
                setPaneStateValue("muted", !paneStateData.muted);
              }}
              muted={paneStateData.muted}
            />
          </div>
          <div className={styles.verticalCenter}>
            <ExpandButton />
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className={styles.controls}>
        <div className={styles.dropdown}>
          <ModalDropdown size="skinny" color="grey" modal={DownlinksModal}>
            <span>DL</span>
          </ModalDropdown>
        </div>
        <div className={styles.rightButtons}>
          <div className={styles.verticalCenter}>
            <IOInfoButton
              clickHandler={() => {
                setPaneStateValue("infoToggle", !paneStateData.showInfo);
              }}
              selected={paneStateData.showInfo}
            />
          </div>
          <div className={styles.verticalCenter} style={{ width: "30px" }}>
            <MuteButton
              clickHandler={() => {
                setPaneStateValue("muted", !paneStateData.muted);
              }}
              muted={paneStateData.muted}
            />
          </div>
          <div className={styles.verticalCenter}>
            <ExpandButton />
          </div>
        </div>
      </div>
    );
  }

  function DownlinksModal() {
    return (
      <div className={styles.monthModal}>
        {downlinks.map((d) => {
          let color = "disabled";
          if (downlinkAvailability[d]) {
            color = "active";
          }
          if (paneStateData.downlink === d) {
            color = "selected";
          }
          return (
            <Button
              key={"DLBUTTON_" + d + "_" + frameID}
              color={color}
              size="small"
              rounded={"none"}
              callback={() => {
                setPaneStateValue("downlink", d);
              }}
            >
              <div className={styles.dlLabel}>{d + 1}</div>
            </Button>
          );
        })}
      </div>
    );
  }
}

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

export default function VideoPane(props: { frameID: number }) {
  const frameID: number = props.frameID;

  const dispatch = useDispatch();

  const videos: VideosEntityState = useSelector((state: RootState) => state.videos);
  const playhead: PlayheadState = useSelector((state: RootState) => state.playhead);

  const paneStateData: VideoDLPaneControlStateData = useSelector(
    (state: RootState) => state.framework.frames[props.frameID].paneStateData
  );
  function setPaneStateValue(propertyName, propertyValue) {
    dispatch(
      setPaneStateDataValue({
        frameID,
        paneStateProperty: propertyName,
        paneStateValue: propertyValue,
      })
    );
  }

  const playheadDate = new Date(playhead.date);
  const startOfDay = playheadDate.valueOf() / 1000;

  const videoFiles: VideoFile[] = videoSelectors.selectAll(videos);
  const visibleVideos = visibleVideosBySecond(videoFiles, playheadDate);

  const videoElement = useRef() as MutableRefObject<HTMLVideoElement>;
  const [metadata, setMetadata] = useState(null);
  const [status, setStatus] = useState(null);
  const [sourceURL, setSourceURL] = useState("");

  const clearMetadata = () => {
    if (visibleVideos.size === 0) {
      return;
    }
    const videoID = paneStateData.activeVideoFileID;
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

    const downlink = paneStateData.downlink;
    const activeVideoFileID = paneStateData.activeVideoFileID;

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

    // if (downlink === 6) {
    //   videoID = videos.nonDownlinkIDs[frameID];
    //   if (videosNextSecond && !videosNextSecond.includes(videoID)) {
    //     videoID = videosNextSecond[0];
    //     dispatch(setVideoNonDownlinkID({ frameID, nonDownlinkID: videoID }));
    //   }
    //   if (videosNextSecond && videosNextSecond.length === 0 && videoID !== "") {
    //     dispatch(setVideoNonDownlinkID({ frameID, nonDownlinkID: "" }));
    //   }
    // }

    // if the video source needs to change, change it
    if (videoID !== activeVideoFileID) {
      setPaneStateValue("activeVideoFileID", videoID);

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
      paneStateData.activeVideoFileID
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
          setPaneStateValue("muted", true);
        }
      }
    })();
  };

  const updateSourceInfo = () => {
    const videoID = paneStateData.activeVideoFileID;

    if (videoID !== "" && videoID !== undefined) {
      // there is a video for this downlink
      const currentlyPlayingVideo = videoSelectors.selectById(videos, videoID);
      setSourceURL(currentlyPlayingVideo.mediaLowResURL);
    } else {
      // there is no video for this downlink
      // clear out the video player
      setSourceURL("");

      // don't block the playhead
      if (!paneStateData.ready) {
        setPaneStateValue("ready", true);
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
        paneStateData.activeVideoFileID
      );

      if (isNil(currentlyPlayingVideo)) {
        return;
      }

      const videoStartOffset = playhead.seconds - (currentlyPlayingVideo.start - startOfDay);
      videoElement.current.currentTime = videoStartOffset;
    }
  };

  useEffect(changeVideoFile, [playhead.seconds, videoFiles, paneStateData]);
  useEffect(clearMetadata, [playhead.date, paneStateData.activeVideoFileID, videoFiles]);
  useEffect(playOrPause, [playhead.isRunning, playhead.seconds, sourceURL]);
  useEffect(syncToPlayhead, [playhead.seconds, paneStateData.activeVideoFileID]);
  useEffect(updateSourceInfo, [paneStateData.activeVideoFileID]);
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

    const videoID = paneStateData.activeVideoFileID;
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
    const shouldMute = paneStateData.muted || isLOSVideo;

    return (
      <div key={`video_element__${frameID}`} className={styles.vidContainer}>
        <div className={`${styles.playerPoster} ${posterClass}`}>
          <video
            ref={videoElement}
            className={styles.player}
            src={sourceURL}
            muted={shouldMute}
            onCanPlay={() => {
              if (!paneStateData.ready) {
                setPaneStateValue("ready", true);
              }
            }}
            onEnded={() => {
              // ready up because we don't want a missing video to hold up the playhead
              setPaneStateValue("ready", true);
            }}
            onWaiting={() => {
              if (paneStateData.ready && sourceURL !== "") {
                setPaneStateValue("ready", false);
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
              if (paneStateData.activeVideoFileID !== "") {
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
              if (paneStateData.ready !== true) {
                setPaneStateValue("ready", true);
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

  const renderVideoOverlay = () => {
    const currentlyPlayingVideo = videoSelectors.selectById(
      videos,
      paneStateData.activeVideoFileID
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
    if (paneStateData.showInfo) {
      infoDisplayClass = styles.videoOverlayVisible;
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

  return (
    <div className={styles.mediaPanel} key={`video_player__${frameID}`}>
      {renderVideoElement()}
    </div>
  );
}
