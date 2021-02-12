import Link from "next/link";
import { useRouter } from "next/router";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ClockState, isSameDate } from "store/clock";
import {
  buffering,
  setVideoDownlink,
  pickVideoFile,
  ready,
  selectVideoActivity,
  VideoActivity,
  VideosState,
} from "store/videos";
import { secondsToHHMMSS, secondsToZuluString } from "utils/formatting";
import styles from "./video.module.css";

/**
 * Renders a video and the downlink buttons
 */
export default function Videos({ id }: { id: number }) {
  const { query } = useRouter();
  const dispatch = useDispatch();
  const { videos, clock }: { videos: VideosState; clock: ClockState } = useSelector(
    (state) => state
  );
  const videoElement = useRef() as MutableRefObject<HTMLVideoElement>;
  const [muted, setMuted] = useState(id !== 1);
  const [metadata, setMetadata] = useState(null);
  const [status, setStatus] = useState(null);
  const [sourceURL, setSourceURL] = useState("");
  const [info, setInfo] = useState("");

  let videoActivity = null as VideoActivity;

  if (Object.keys(videos.videos).length > 0) {
    videoActivity = selectVideoActivity(videos);
  }

  const getInitialDownlink = () => {
    const queryParam = query[`video${id}`];
    const downlink = (+queryParam || id) - 1;
    if (videos.downlinks[id] !== downlink) {
      dispatch(setVideoDownlink({ id, downlink }));
    }
  };

  const clearMetadata = () => {
    if (Object.keys(videos.videos).length === 0) {
      return;
    }
    const videoID = videos.activeVideoFiles[id];
    const videoStart = videos.videos[videoID]?.start || 0;
    if (videoID || !isSameDate(new Date(clock.date), new Date(videoStart))) {
      setMetadata(null);
    }
  };

  const changeVideoFile = () => {
    // This stops one buffering video from essentially blocking beginning to buffer the other video
    if (!clock.isRunning) {
      return;
    }

    // we can't update videos if we don't have videos
    if (!videoActivity) {
      return;
    }

    const group = videos.downlinks[id];
    const activeVideoFileID = videos.activeVideoFiles[id];
    const videosNextSecond = videoActivity[group][clock.time + 1];

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
      dispatch(pickVideoFile({ id, videoID }));

      // wipe out the metadata for this videoElement so that aspect will be recalculated when the next video loads
      setMetadata(null);
    }
  };

  const syncToClock = () => {
    // This stops one buffering video from essentially blocking beginning to buffer the other video
    if (!clock.isRunning) {
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

    const currentlyPlayingVideo = videos.videos[videos.activeVideoFiles[id]];
    let videoStartOffset = 0;
    if (currentlyPlayingVideo) {
      videoStartOffset = clock.time - currentlyPlayingVideo.missionSecondsStart;
    }

    if (Math.abs(currentTime - videoStartOffset) > 1) {
      videoElement.current.currentTime = videoStartOffset;
    }
  };

  const playOrPause = () => {
    (async () => {
      try {
        if (clock.isRunning) {
          // make sure the video is playing when the clock is running
          await videoElement.current.play();
        } else if (!clock.isRunning) {
          // make sure the video is paused when the clock isn't running
          await videoElement.current.pause();
        }
      } catch (e) {
        // Swallow errors here because we have to try to play empty src
        // because HTML video won't unload a video when src is undefined
      }
    })();
  };

  const updateSourceInfo = () => {
    const videoID = videos.activeVideoFiles[id];

    if (videoID !== "") {
      // there is a video for this downlink
      const video = videos.videos[videoID];
      setSourceURL(video.videoURL);
      setInfo(video.description);
    } else {
      // there is no video for this downlink
      // clear out the video player
      setSourceURL("");
      setInfo("");

      // don't block the clock
      if (!videos.ready[id]) {
        dispatch(ready(id));
      }
    }
  };

  useEffect(changeVideoFile, [clock.time, videos.videos]);
  useEffect(clearMetadata, [clock.date, videos.activeVideoFiles[id], videos.videos]);
  useEffect(getInitialDownlink, [query]);
  useEffect(playOrPause, [clock.isRunning, clock.time, sourceURL]);
  useEffect(syncToClock, [clock.time, videos.activeVideoFiles[id]]);
  useEffect(updateSourceInfo, [videos.activeVideoFiles[id]]);

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
        key={`video_element__${id}`}
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
            if (!videos.ready[id]) {
              dispatch(ready(id));
            }
          }}
          onEnded={() => {
            // ready up because we don't want a missing video to hold up the clock
            dispatch(ready(id));
          }}
          onWaiting={() => {
            if (videos.ready[id] && sourceURL !== "") {
              dispatch(buffering(id));
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
                `video ${id} has thrown an error ${vidElement.error.code} - ${vidElement.error.message}`
              );
            } else {
              setStatus("novid");
            }
            //unblocking clock
            if (videos.ready[id] !== true) {
              dispatch(ready(id));
            }
          }}
        />
        {renderVideoOverlay()}
      </div>
    );
  };

  const renderButtons = () => {
    const group = videos.downlinks[id];
    const availableGroups = [0, 1, 2, 3, 4, 5, 6];

    return availableGroups.map((g) => {
      let buttonClassStyle = styles.vidButton;
      if (g === group) {
        buttonClassStyle = `${buttonClassStyle} ${styles.selected}`;
      } else if (videoActivity && videoActivity[g][clock.time].length > 0) {
        buttonClassStyle = `${buttonClassStyle} ${styles.active}`;
      }
      return (
        <button
          key={`vid${id}__button${g}`}
          type="button"
          title={`Select downlink ${g + 1}`}
          className={buttonClassStyle}
          onClick={() => {
            if (g !== group) {
              dispatch(setVideoDownlink({ id, downlink: g }));
            }
          }}
        >
          {g < 6 ? `D/L ${g + 1}` : "non-D/L"}
        </button>
      );
    });
  };

  const [copyButtonText, setCopyButtonText] = useState("COPY LINK");

  function handleCopyToClipboard(e) {
    //shareURLtextarea.current.select();
    // navigator.clipboard.writeText(shareURLtextarea.current.value);
    document.execCommand("copy");
    e.target.focus();
    setCopyButtonText("LINK COPIED");
  }

  const renderVideoOverlay = () => {
    const currentlyPlayingVideo = videos.videos[videos.activeVideoFiles[id]];
    let videoStartOffset = 0;
    let ioSearchLink = "";
    let ioVideoURL = "";
    let videoFilename = "";
    let dateAdded = "";
    if (currentlyPlayingVideo) {
      videoStartOffset = clock.time - currentlyPlayingVideo.missionSecondsStart;
      videoFilename = currentlyPlayingVideo.id;
      ioSearchLink = `https://io.jsc.nasa.gov/app/search/results.cfm?q=${videoFilename}&rpp1=50`;
      ioVideoURL = `${currentlyPlayingVideo.videoURL}#t=${videoStartOffset}`;
      dateAdded = currentlyPlayingVideo.md_creation_date;
    }

    return (
      <div className={styles.vidOverlay}>
        <div className={styles.overlayContainer}>
          <div className={styles.overlayHeadline}>Imagery Online Video Details</div>
          <div className={styles.overlayBody}>
            <table className={styles.overlayTable}>
              <tr>
                <td>Description</td>
                <td>{info}</td>
              </tr>
              <tr>
                <td>Date Added</td>
                <td>{dateAdded}</td>
              </tr>
              <tr>
                <td>IO Asset Name</td>
                <td>
                  {videoFilename} <br />
                  <a href={ioSearchLink} target="_blank">
                    Open on IO
                  </a>
                </td>
              </tr>
              <tr>
                <td>Video URL</td>
                <td>
                  {ioVideoURL} <br />
                  <a href={ioVideoURL} target="_blank">
                    Open video file directly at {secondsToHHMMSS(videoStartOffset)}
                  </a>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const mutedClass = muted === true ? styles.unmute : styles.mute;

  return (
    <div className={styles.vidPanel} key={`video_player__${id}`}>
      {renderButtons()}
      <div className={styles.soundBtnOutline}>
        <div className={`${styles.soundBtn} ${mutedClass}`} onClick={() => setMuted(!muted)}></div>
      </div>
      {renderVideoElement()}
    </div>
  );
}
