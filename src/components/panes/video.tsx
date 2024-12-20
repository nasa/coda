import isNull from "lodash/isNull";
import isNil from "lodash/isNil";
import { FunctionComponent, MutableRefObject, useEffect, useRef, useState } from "react";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import {
  faExpandAlt,
  faInfo,
  faVolumeUp,
  faVolumeMute,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "components/interface/button";
import type { RootState } from "store/index";
import { visibleVideosBySecond } from "store/videos";
import {
  appSecondsFromDateString,
  cleanCollectionsString,
  hhmmssFromSeconds,
} from "utils/formatting";
import styles from "./video.module.css";
import { setPaneStateValue } from "store/framework";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { ModalDropdown } from "components/interface/dropdown-modal";
import { isSameDate, midnightZulu } from "../../utils/date";
import VideoMTXPlaybackPane from "./video-mtx-playback";
import VideoHlsPane from "./video-hls";

export const IOInfoButton: FunctionComponent<{
  clickHandler: Function;
  selected?: boolean;
  frameDimensions: number[];
}> = ({ clickHandler, selected, frameDimensions }) => {
  const buttonLength = frameDimensions[0] > 470 ? styles.ioButtonLong : styles.ioButtonShort;
  const iconAdjustment =
    frameDimensions[0] > 470 ? styles.iconAdjustmentLong : styles.iconAdjustmentShort;
  const selectedStyle = selected ? styles.selected : "";
  return (
    <button
      className={`${styles.ioButton} ${buttonLength} ${selectedStyle}`}
      onClick={() => {
        if (clickHandler) {
          clickHandler();
        }
      }}
    >
      <span className={styles.ioLabel}>
        {frameDimensions[0] > 470 ? "IO " : ""}
        <span className={iconAdjustment}>
          <FontAwesomeIcon icon={faInfo} />
        </span>
      </span>
    </button>
  );
};

export const MuteButton: FunctionComponent<{ clickHandler: Function; muted: boolean }> = ({
  clickHandler,
  muted,
}) => {
  let icon;
  if (muted) {
    icon = <FontAwesomeIcon icon={faVolumeMute} />;
  } else {
    icon = <FontAwesomeIcon icon={faVolumeUp} />;
  }

  return (
    <button
      className={styles.clearTextButton}
      onClick={() => {
        if (clickHandler) {
          clickHandler();
        }
      }}
    >
      {icon}
    </button>
  );
};

export const ExpandButton: FunctionComponent = () => {
  return (
    <button className={styles.clearTextButton}>
      <FontAwesomeIcon icon={faExpandAlt} />
    </button>
  );
};

const RightButtons: FunctionComponent<{
  frameID: number;
  paneStateData: VideoPaneStateData;
  frameDimensions: number[];
}> = ({ frameID, paneStateData, frameDimensions }) => {
  const dispatch = useAppDispatch();
  const frames = useAppSelector((state: RootState) => state.framework.frames, deepEqual);

  const playhead: PlayheadState = useAppSelector((state: RootState) => state.playhead, deepEqual);
  const mtxPlaybackRecordsForDownlink = useAppSelector((state: RootState) => {
    const downlinkNumber = (state.framework.frames[frameID].paneStateData.channel + 1).toString();
    return state.videos.mtxPlaybackAvailability[downlinkNumber];
  }, deepEqual);

  const [videoPlayerType, setVideoPlayerType] = useState<VideoPlayerType>("IO");

  useEffect(() => {
    // if there is MTX video available, use the MTX playback video pane
    let videoPlayerType: VideoPlayerType = "IO";
    if (mtxPlaybackRecordsForDownlink?.length > 0) {
      for (const mtxPlaybackRecord of mtxPlaybackRecordsForDownlink) {
        // check that the mtxPlaybackRecord is for today. Remember that these records were modifed
        // when they were fetched to look like they started at 00:00 today if they started before today
        if (!isSameDate(new Date(mtxPlaybackRecord.start), new Date(playhead.date))) continue;

        const mtxDlStartAppSeconds = appSecondsFromDateString(mtxPlaybackRecord.start);
        if (
          playhead.seconds >= mtxDlStartAppSeconds &&
          playhead.seconds < mtxDlStartAppSeconds + mtxPlaybackRecord.duration
        ) {
          videoPlayerType = "MTX";
          break;
        }
      }
    }

    // if it's "today" and the playhead is within 15 minutes of the current time of day, use HLS
    const now = new Date();
    const nowSeconds = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
    if (isSameDate(new Date(playhead.date), now) && Math.abs(playhead.seconds - nowSeconds) < 900) {
      videoPlayerType = "HLS";
    }
    setVideoPlayerType(videoPlayerType);
  }, [frameID, playhead.seconds, mtxPlaybackRecordsForDownlink, playhead.date]);

  /**
   * When unmuting, we need to make this pane the only video pane that is unmuted and mute the others.
   */
  function handleMuteButtonClick() {
    // If we're already muted, unmute this video pane and mute the other video panes.
    if (paneStateData.muted) {
      for (const [key, value] of Object.entries(frames)) {
        if (value.paneType.includes("video")) {
          if (parseInt(key) !== frameID) {
            setPaneStateValue(dispatch, parseInt(key), "muted", true);
          } else {
            setPaneStateValue(dispatch, frameID, "muted", false);
          }
        }
      }
    } else {
      // If we're not muted, mute this video pane
      setPaneStateValue(dispatch, frameID, "muted", true);
    }
  }

  return (
    <div className={styles.rightButtonsContainer}>
      <div className={styles.rightButtons}>
        {videoPlayerType === "IO" && (
          <>
            <div className={styles.verticalCenter}>
              <MuteButton
                clickHandler={() => {
                  handleMuteButtonClick();
                }}
                muted={paneStateData.muted}
              />
            </div>
            <div className={styles.verticalCenter}>
              <IOInfoButton
                clickHandler={() => {
                  setPaneStateValue(dispatch, frameID, "showInfo", !paneStateData.showInfo);
                }}
                selected={paneStateData.showInfo}
                frameDimensions={frameDimensions}
              />
            </div>
          </>
        )}
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => {
              setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
            }}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
};

const channels = [0, 1, 2, 3, 4, 5, 6, 7];

export const ChannelSelectorLarge: FunctionComponent<{
  frameID: number;
  channelAvailability: any;
  paneStateData: VideoPaneStateData;
  frameDimensions: number[];
}> = ({ frameID, channelAvailability, paneStateData, frameDimensions }) => {
  const dispatch = useAppDispatch();
  return (
    <div className={styles.controls}>
      <div className={styles.selections}>
        {channels.map((c) => {
          let rounded = "none";
          if (c === 0) {
            rounded = "left";
          } else if (c === 7) {
            rounded = "right";
          }

          let color = "disabled";
          if (channelAvailability[c]) {
            color = "active";
          }
          if (paneStateData.channel === c) {
            if (channelAvailability[c]) {
              color = "active_selected";
            } else {
              color = "disabled_selected";
            }
          }

          return (
            <Button
              key={"DLBUTTON_" + c + "_" + frameID}
              color={color}
              size="small"
              rounded={rounded}
              callback={() => {
                setPaneStateValue(dispatch, frameID, "channel", c);
              }}
            >
              <div className={styles.dlLabel}>{c + 1}</div>
            </Button>
          );
        })}
      </div>
      <RightButtons
        frameID={frameID}
        paneStateData={paneStateData}
        frameDimensions={frameDimensions}
      />
    </div>
  );
};

export const ChannelSelectorSmall: FunctionComponent<{
  frameID: number;
  channelAvailability: boolean[];
  paneStateData: VideoPaneStateData;
  frameDimensions: number[];
}> = ({ frameID, channelAvailability, paneStateData, frameDimensions }) => {
  return (
    <div className={styles.controls}>
      <div className={styles.dropdown}>
        <ModalDropdown
          color="grey"
          size="skinny"
          modal={ChannelDropdownModal}
          modalOptions={{ frameID, channelAvailability, channelSelected: paneStateData?.channel }}
        >
          {!isNil(channelAvailability) ? (
            <ChannelDropdownLabel
              dlNumber={paneStateData.channel}
              isAvailable={channelAvailability[paneStateData.channel]}
            />
          ) : (
            <>&nbsp;DL</>
          )}
        </ModalDropdown>
      </div>
      <RightButtons
        frameID={frameID}
        paneStateData={paneStateData}
        frameDimensions={frameDimensions}
      />
    </div>
  );
};

const ChannelDropdownLabel: FunctionComponent<{
  dlNumber: number;
  isAvailable: boolean;
}> = ({ dlNumber, isAvailable }) => {
  let color = isAvailable ? "active_selected" : "disabled_selected";

  return (
    <div className={`${styles.chDropdownLabel} ${styles[color]}`}>
      <div className={styles.verticalCenter}>{dlNumber + 1}</div>
    </div>
  );
};

/** Renders a modal with a list of frame types to choose from */
const ChannelDropdownModal: FunctionComponent<{
  closeClick: () => void;
  options: { frameID: number; channelAvailability: boolean[]; channelSelected: number };
}> = ({ closeClick, options: { frameID, channelAvailability, channelSelected } }) => {
  const dispatch = useAppDispatch();

  const handleSelectChannel = (dlChannel: number) => {
    setPaneStateValue(dispatch, frameID, "channel", dlChannel);
    closeClick();
  };

  return (
    <div className={styles.chDropdownModal}>
      {channelAvailability && (
        <>
          {channels.map((c) => {
            let rounded = "none";
            if (c === 0) {
              rounded = "top";
            } else if (c === 7) {
              rounded = "bottom";
            }

            let color = "disabled";
            if (channelAvailability[c]) {
              color = "active";
            }
            if (channelSelected === c) {
              if (channelAvailability[c]) {
                color = "active_selected";
              } else {
                color = "disabled_selected";
              }
            }
            return (
              <div
                onClick={() => {
                  handleSelectChannel(c);
                }}
                key={`CHANNEL__PICKER__${frameID}__${c}`}
              >
                <Button color={color} size="small" rounded={rounded}>
                  <div className={styles.dlLabel}>{c + 1}</div>
                </Button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export const VideoDLPaneControls: FunctionComponent<{
  frameID: number;
  frameDimensions: number[];
}> = ({ frameID, frameDimensions }) => {
  const minWidth = 527; // minimum width of the video pane before breaking into dropdown for downlinks

  const videos: VideosState = useAppSelector((state: RootState) => state.videos, deepEqual);
  const playhead: PlayheadState = useAppSelector((state: RootState) => state.playhead, deepEqual);
  const playheadDate = new Date(playhead.date);
  const videoFiles = videos.videoFiles;
  const visibleVideos = visibleVideosBySecond(videoFiles, playheadDate);
  const mtxPlaybackAvailability = useAppSelector((state: RootState) => {
    return state.videos.mtxPlaybackAvailability;
  }, deepEqual);
  const mtxHlsEndpointNames = useAppSelector(
    (state: RootState) => state.videos.mtxHlsEndpointNames,
    deepEqual
  );

  const paneStateData: VideoPaneStateData = useAppSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );

  const [channelAvailability, setChannelAvailability] = useState<boolean[]>([]);

  useEffect(() => {
    const cAvailability = [];

    // loop through all channel numbers and check if there is either mtxPlayback video or IO video available for each channel at this time
    for (let channel = 0; channel < 8; channel++) {
      let mtxForThisChannel = false;
      let ioVideoForThisChannel = false;

      const downlinkNumber = (channel + 1).toString();
      const mtxPlaybackRecordsForDownlink = mtxPlaybackAvailability[downlinkNumber] || [];
      for (const mtxPlaybackRecord of mtxPlaybackRecordsForDownlink) {
        // check that the mtxPlaybackRecord is for today. Remember that these records were modifed
        // when they were fetched to look like they started at 00:00 today if they started before today
        if (!isSameDate(new Date(mtxPlaybackRecord.start), new Date(playhead.date))) continue;

        const mtxDlStartAppSeconds = appSecondsFromDateString(mtxPlaybackRecord.start);
        if (
          playhead.seconds >= mtxDlStartAppSeconds &&
          playhead.seconds < mtxDlStartAppSeconds + mtxPlaybackRecord.duration
        ) {
          mtxForThisChannel = true;
          break;
        }
      }
      const videosNextSecond = visibleVideos.get(`${playhead.seconds + 1}/${channel}`);
      ioVideoForThisChannel = !isNil(videosNextSecond);

      // are we within 15 minutes of the current time? if so, say there is HLS video available
      let hlsForThisChannel = false;
      const now = new Date();
      const nowSeconds = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
      if (
        isSameDate(new Date(playhead.date), now) &&
        Math.abs(playhead.seconds - nowSeconds) < 900
      ) {
        // loop through the hlsEndpointNames and look for this downlink channel
        for (const mtxHlsEndpointName of mtxHlsEndpointNames) {
          if (mtxHlsEndpointName.includes(downlinkNumber)) {
            hlsForThisChannel = true;
          }
        }
      }

      cAvailability.push(mtxForThisChannel || ioVideoForThisChannel || hlsForThisChannel);
    }
    setChannelAvailability(cAvailability);
  }, [visibleVideos, playhead.seconds, mtxPlaybackAvailability, mtxHlsEndpointNames]);

  if (frameDimensions[0] > minWidth) {
    return (
      <ChannelSelectorLarge
        frameID={frameID}
        channelAvailability={channelAvailability}
        paneStateData={paneStateData}
        frameDimensions={frameDimensions}
      />
    );
  } else {
    return (
      <ChannelSelectorSmall
        frameID={frameID}
        channelAvailability={channelAvailability}
        paneStateData={paneStateData}
        frameDimensions={frameDimensions}
      />
    );
  }
};

export const VideoOtherPaneControls: FunctionComponent<{
  frameID: number;
  frameDimensions: number[];
}> = ({ frameID, frameDimensions }) => {
  const dispatch = useAppDispatch();

  const minWidth = 527; // minimum width of the video pane before breaking into dropdown for downlinks

  const videos: VideosState = useAppSelector((state: RootState) => state.videos, deepEqual);
  const playhead: PlayheadState = useAppSelector((state: RootState) => state.playhead, deepEqual);
  const playheadDate = new Date(playhead.date);
  const videoFiles = videos.videoFiles;
  const visibleVideos = visibleVideosBySecond(videoFiles, playheadDate);

  const [nonDlVideoIDs, setNonDlVideoIDs] = useState([]);

  const paneStateData: VideoPaneStateData = useAppSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );

  const getPrettyVideoTitle = (videoID: string) => {
    const video = videoFiles.find((v) => v.id === videoID);
    if (video) {
      if (video.title && video.title.trim() !== "") {
        return video.title;
      }
      return cleanCollectionsString(video.collections) + " - " + videoID;
    }
    return "";
  };

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

  useEffect(() => {
    setNonDlVideoIDs(visibleVideos.get(`${playhead.seconds}/-1`) || []);
  }, [visibleVideos, playhead]);

  let selectActiveStyle = "";
  if (nonDlVideoIDs.length > 0) {
    selectActiveStyle = styles.selectActive;
  }

  const dropDownWidthClass =
    frameDimensions[0] > minWidth ? styles.selectContainerWide : styles.selectContainerNarrow;

  return (
    <>
      <div className={styles.controls}>
        <div
          className={`${styles.selectContainer} ${dropDownWidthClass}`}
          title={getPrettyVideoTitle(paneStateData.activeVideoFileID)}
        >
          <select
            className={selectActiveStyle}
            value={paneStateData.activeVideoFileID}
            onChange={(e) => {
              setPaneStateValue(dispatch, frameID, "channel", -1);
              setPaneStateValue(dispatch, frameID, "activeVideoFileID", e.target.value);
            }}
          >
            <option disabled={nonDlVideoIDs.length === 0 ? true : null} value="">
              {nonDlVideoIDs.length > 0 ? "Select Video" : "No other video at this time"}
            </option>
            {optionList()}
          </select>
          <div className={styles.nonDlSelect_arrow}>
            <FontAwesomeIcon icon={faChevronDown} size="sm" />
          </div>
        </div>
        <RightButtons
          frameID={frameID}
          paneStateData={paneStateData}
          frameDimensions={frameDimensions}
        />
      </div>
    </>
  );
};

/**
 * Check whether the error is the browser blocking autoplay of unmuted videos. See https://developers.google.com/web/updates/2017/09/autoplay-policy-changes
 */
export const isAutoplayError = (e: unknown): boolean => {
  // every browser displays a different error message
  const chrome_autoplay_error =
    /play\(\) failed because the user didn't interact with the document first/i;
  const firefox_autoplay_error =
    /The play method is not allowed by the user agent or the platform in the current context, possibly because the user denied permission/i;
  const safari_autoplay_error =
    /The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission/i;

  const isChromeError = !isNull(e.toString().match(chrome_autoplay_error));
  const isFirefoxError = !isNull(e.toString().match(firefox_autoplay_error));
  const isSafariError = !isNull(e.toString().match(safari_autoplay_error));

  return isChromeError || isFirefoxError || isSafariError;
};

const VideoPane: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const dispatch = useAppDispatch();

  const videos: VideosState = useAppSelector((state: RootState) => state.videos, deepEqual);
  const playhead: PlayheadState = useAppSelector((state: RootState) => state.playhead, deepEqual);

  const paneStateData: VideoPaneStateData = useAppSelector(
    (state: RootState) => state.framework.frames[frameID].paneStateData,
    deepEqual
  );

  const playheadDate = new Date(playhead.date);
  const startOfDay = playheadDate.valueOf() / 1000;

  const videoFiles = videos.videoFiles;
  const visibleVideos = visibleVideosBySecond(videoFiles, playheadDate);

  const videoElement = useRef() as MutableRefObject<HTMLVideoElement>;
  const [metadata, setMetadata] = useState(null);
  const [status, setStatus] = useState(null);
  const [sourceURL, setSourceURL] = useState("");

  const clearMetadata = () => {
    if (visibleVideos.size === 0) {
      return;
    }
    const videoID = Number(paneStateData.activeVideoFileID);
    const videoStart: number = videoFiles[videoID]?.start || 0;
    if (videoID || !isSameDate(new Date(playhead.date), new Date(videoStart))) {
      setMetadata(null);
    }
  };

  const changeVideoFile = () => {
    // we can't update videos if we don't have videos
    if (visibleVideos.size === 0) {
      return;
    }

    const channel = paneStateData.channel;
    const videosNextSecondThisChannel = visibleVideos.get(`${playhead.seconds + 1}/${channel}`);
    const activeVideoFileID = paneStateData.activeVideoFileID;

    // check for video changes
    let currVideoID = activeVideoFileID;
    // if the timeline just jumped or the video files changed, make sure we start the right video

    if (channel === -1) {
      // if we're on non-downlink video (designated as downlink -1), we need to reset the video if this video isn't available next second
      if (videosNextSecondThisChannel && !videosNextSecondThisChannel.includes(currVideoID)) {
        currVideoID = "";
      }
    } else {
      // we always use element 0 of the videos available in this downlink for any given second (see store/videos.ts)
      if (videosNextSecondThisChannel && activeVideoFileID !== videosNextSecondThisChannel[0]) {
        /** there is a different video for this downlink the next second! pick the highest priority video for this downlink.
        See store/videos.ts#videoSorter for how video files are sorted */
        currVideoID = videosNextSecondThisChannel[0];
      }

      if (!videosNextSecondThisChannel) {
        // clear the player if no video is playing next second
        currVideoID = "";
      }
    }

    // if the video source needs to change, change it
    if (currVideoID !== activeVideoFileID) {
      setPaneStateValue(dispatch, frameID, "activeVideoFileID", currVideoID);

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
    const currentlyPlayingVideo = videoFiles.find((v) => v.id === paneStateData.activeVideoFileID);
    let videoStartOffset = 0;
    if (currentlyPlayingVideo) {
      videoStartOffset = playhead.seconds - (currentlyPlayingVideo.start - startOfDay);
    }

    if (Math.abs(currentTime - videoStartOffset) > 1) {
      videoElement.current.currentTime = videoStartOffset;
    }
  };

  const playOrPause = () => {
    const asyncFunc = async () => {
      try {
        if (playhead.isRunning) {
          // make sure the video is playing when the playhead is running
          // if the video source is "", trying to play will "unload" the video and we'll show a poster instead
          await videoElement.current.play();
        } else if (!playhead.isRunning) {
          // make sure the video is paused when the playhead isn't running
          await videoElement.current.pause();
        }
      } catch (e: unknown) {
        if (isAutoplayError(e)) {
          // the browser is preventing autoplay of unmuted videos. so let's just mute the video. on the next playhead tick, we'll try to play again
          setPaneStateValue(dispatch, frameID, "muted", true);
        }
      }
    };
    asyncFunc();
  };

  const updateSourceInfo = () => {
    const videoID = paneStateData.activeVideoFileID;

    if (videoID !== "" && videoID !== undefined) {
      // there is a video for this downlink
      const currentlyPlayingVideo = videoFiles.find((v) => v.id === videoID);
      if (currentlyPlayingVideo) {
        setSourceURL(currentlyPlayingVideo.mediaLowResURL);
      }
    } else {
      // there is no video for this downlink
      // clear out the video player
      setSourceURL("");

      // don't block the playhead
      if (!paneStateData.ready) {
        setPaneStateValue(dispatch, frameID, "ready", true);
      }
    }
  };

  const toggleFullScreen = () => {
    const el = videoElement.current;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  const cueVideoToPlayhead = () => {
    // cue the new video to the right start time to avoid buffering the beginning of the video needlessly
    if (sourceURL !== "") {
      const currentlyPlayingVideo = videoFiles.find(
        (v) => v.id === paneStateData.activeVideoFileID
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
  useEffect(updateSourceInfo, [paneStateData.activeVideoFileID, videos]);
  useEffect(cueVideoToPlayhead, [sourceURL]);

  /**
   * Renders the actual HTML5 video
   */
  const renderVideoElement = () => {
    // Displays video background poster to depect novid, buffering,
    // or blank if video loaded or buffering during playback
    // metadata used to determine whether a buffering event is happening on an already playing video
    // or a new loading event
    let posterState = "novid";
    // hide noVid poster if video metadata has been loaded
    if (metadata || status === "playing") {
      posterState = "none";
    }
    if (status === "buffering") {
      // if there is no metadata then this is the buffering of a new video. Show loader.
      if (!metadata) {
        posterState = "buffering";
      } else {
        posterState = "none";
      }
    }

    const videoID = paneStateData.activeVideoFileID;
    let video: VideoFile;
    if (videoID !== "") {
      video = videoFiles.find((v) => v.id === videoID);
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
      ioErrorMessage = "Incorrect Time Data on Imagery Online";
    }

    // the audio in LOS downlinked videos is never synced to the video
    const isLOSVideo = !isNil(video) && video.LOS;
    const shouldMute = paneStateData.muted || isLOSVideo;

    return (
      <div key={`video_element__${frameID}`} className={styles.vidContainer}>
        {posterState === "novid" ? <div className={styles.playerPosterNovid}></div> : null}
        {posterState === "buffering" ? (
          <>
            <div className={styles.playerPosterNovid}></div>
            <div className={styles.playerPosterBuffering}>
              <div className={styles.loaderAnimation}></div>
            </div>
          </>
        ) : null}
        <video
          ref={videoElement}
          className={styles.player}
          src={sourceURL}
          muted={shouldMute}
          onCanPlay={() => {
            if (!paneStateData.ready) {
              setPaneStateValue(dispatch, frameID, "ready", true);
            }
          }}
          onEnded={() => {
            // ready up because we don't want a missing video to hold up the playhead
            setPaneStateValue(dispatch, frameID, "ready", true);
          }}
          onWaiting={() => {
            if (paneStateData.ready && sourceURL !== "") {
              setPaneStateValue(dispatch, frameID, "ready", false);
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
              setPaneStateValue(dispatch, frameID, "ready", true);
            }
          }}
          onClick={() => {
            if (paneStateData.activeVideoFileID !== "") {
              toggleFullScreen();
            }
          }}
        />
        <div className={styles.IOError} style={ioErrorCSS}>
          {ioErrorMessage}
        </div>

        {renderVideoOverlay()}
        <HelpOverlay
          isModalOpen={paneStateData.showHelp}
          closeHandler={() => {
            setPaneStateValue(dispatch, frameID, "showHelp", !paneStateData.showHelp);
          }}
        >
          <div>
            <p>Displays videos from Imagery Online, synced to CODA's playback time.</p>
            <p>
              Videos are all pulled from Imagery Online collections. ISS displays videos in the{" "}
              <a href={"https://io.jsc.nasa.gov/app/collections.cfm?cid=4"} target={"_blank"}>
                ISS Collection
              </a>
              . Exploration Test Events usually pulls from the root{" "}
              <a href={"https://io.jsc.nasa.gov/app/collections.cfm?cid=2359928"} target={"_blank"}>
                xEVA Collection
              </a>{" "}
              but this can be overridden by editing the CODA entry for each event in the{" "}
              <a
                href={"https://wiki.jsc.nasa.gov/exploration/index.php/Main_Page"}
                target={"_blank"}
              >
                Exploration Wiki.
              </a>
            </p>
            <p>There are two types of Video displays:</p>
            <ol>
              <li>
                Video Channels
                <p>
                  Videos from Imagery Online are categorized based on what ISS downlink channel they
                  were received on. Select a downlink channel using the downlink channel numbers
                  above the video.
                </p>
                <p>
                  For Test and NBL events, channels have been inferred for common video source
                  types.
                </p>
              </li>
              <li>
                Video Other
                <p>
                  Contains the remaining videos from Imagery Online that have not been categorized
                  into channels. Videos available at a given CODA time are selected via dropdown.
                </p>
              </li>
            </ol>
            <p>
              Note: If video entries in Imagery Online do not have valid start times, an error will
              be displayed in CODA to indicate that the video is not correctly time synced.
            </p>
          </div>
        </HelpOverlay>
      </div>
    );
  };

  const renderVideoOverlay = () => {
    const currentlyPlayingVideo = videoFiles.find((v) => v.id === paneStateData.activeVideoFileID);
    let videoStartOffset = 0;
    let ioSearchLink = "";
    let ioVideoURL = "";
    let openVideoURLMessage = "";
    let videoFilename = "";
    let title = "";
    let startDateTime = "";
    let openOnIOMessage = "";
    let info = "";
    if (currentlyPlayingVideo) {
      videoStartOffset = playhead.seconds - Math.max(currentlyPlayingVideo.start - startOfDay, 0);
      videoFilename = currentlyPlayingVideo.id;
      ioSearchLink = currentlyPlayingVideo.dataURL;
      ioVideoURL = `${currentlyPlayingVideo.mediaLowResURL}#t=${videoStartOffset}`;
      openVideoURLMessage = `Open video file directly at ${hhmmssFromSeconds(videoStartOffset)}`;
      openOnIOMessage = `Open on IO`;
      title = currentlyPlayingVideo.title;
      startDateTime = new Date(currentlyPlayingVideo.startDateTime).toUTCString();
      info = currentlyPlayingVideo.description;
    }
    if (paneStateData.showInfo) {
      return (
        <div className={`${styles.vidOverlay} ${styles.videoOverlayVisible}`}>
          <table className={styles.overlayTable}>
            <tbody>
              <tr>
                <td>Title</td>
                <td>{title}</td>
              </tr>
              <tr>
                <td>Date Added</td>
                <td>{startDateTime}</td>
              </tr>
              <tr>
                <td>IO Asset Name</td>
                <td>
                  <a href={ioSearchLink} target="_blank" style={{ fontSize: "0.9em" }}>
                    {openOnIOMessage}
                  </a>
                  <div className={styles.digiValue}>{videoFilename}</div>
                </td>
              </tr>
              <tr>
                <td>Video URL</td>
                <td>
                  <a href={ioVideoURL} target="_blank" style={{ fontSize: "0.9em" }}>
                    {openVideoURLMessage}
                  </a>
                  <br />
                  <span
                    className={styles.digiValue}
                    style={{ fontSize: "0.9em", color: "#BBBBBB" }}
                  >
                    {ioVideoURL}
                  </span>
                </td>
              </tr>
              <tr>
                <td>IO Description</td>
                <td>{info}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    } else {
      return null;
    }
  };

  return (
    <div className={styles.mediaPanel} key={`video_player__${frameID}`}>
      {renderVideoElement()}
    </div>
  );
};

const VideoPaneChooser: FunctionComponent<{ frameID: number }> = ({ frameID }) => {
  const playhead: PlayheadState = useAppSelector((state: RootState) => state.playhead, deepEqual);
  const videos: VideosState = useAppSelector((state: RootState) => state.videos, deepEqual);
  const downlinkNumber = useAppSelector((state: RootState) => {
    return state.framework.frames[frameID].paneStateData.channel;
  }, refEqual);

  const mtxPlaybackRecordsForDownlink = useAppSelector((state: RootState) => {
    const downlinkNumber = (state.framework.frames[frameID].paneStateData.channel + 1).toString();
    return state.videos.mtxPlaybackAvailability[downlinkNumber];
  }, deepEqual);

  // if live video system is diabled, always show the IO player
  const liveEnabled = import.meta.env.VITE_PUBLIC_LIVE_STREAMS_ENABLED === "true";
  if (!liveEnabled) {
    return <VideoPane frameID={frameID} />;
  }

  // Choose the player type as: if there is IO, use it, else if there is HLS, use it, else if there is MTX use it. If none of these, just show the IO player anyway
  let videoPlayerType: VideoPlayerType = null;

  // if there is MTX video available, use the MTX playback video pane
  if (mtxPlaybackRecordsForDownlink?.length > 0) {
    for (const mtxPlaybackRecord of mtxPlaybackRecordsForDownlink) {
      // check that the mtxPlaybackRecord is for today. Remember that these records were modifed
      // when they were fetched to look like they started at 00:00 today if they started before today
      if (!isSameDate(new Date(mtxPlaybackRecord.start), new Date(playhead.date))) continue;

      const mtxDlStartAppSeconds = appSecondsFromDateString(mtxPlaybackRecord.start);
      if (
        playhead.seconds >= mtxDlStartAppSeconds &&
        playhead.seconds < mtxDlStartAppSeconds + mtxPlaybackRecord.duration
      ) {
        videoPlayerType = "MTX";
        break;
      }
    }
  }

  // if it's "today" and the playhead is within 15 minutes of the current time of day, use HLS
  const now = new Date();
  const nowSeconds = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  if (isSameDate(new Date(playhead.date), now) && Math.abs(playhead.seconds - nowSeconds) < 900) {
    videoPlayerType = "HLS";
  }

  // if there is IO video available, use the IO video pane

  if (downlinkNumber !== -1) {
    const videoFiles = videos.videoFiles;
    const visibleVideos = visibleVideosBySecond(videoFiles, new Date(playhead.date));
    const videosNextSecond = visibleVideos.get(`${playhead.seconds + 1}/${downlinkNumber}`);
    if (videosNextSecond) {
      videoPlayerType = "IO";
    }
  }

  // If none of these, just show the IO player anyway
  if (videoPlayerType === null) {
    videoPlayerType = "IO";
  }

  if (videoPlayerType === "MTX") {
    return <VideoMTXPlaybackPane frameID={frameID} />;
  } else if (videoPlayerType === "HLS") {
    return <VideoHlsPane frameID={frameID} />;
  } else {
    return <VideoPane frameID={frameID} />;
  }
};
export default VideoPaneChooser;
