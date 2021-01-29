import { useRouter } from "next/router";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ClockState, getMissionTime, isSameDate } from "store/clock";
import {
  buffering,
  pickVideoFile,
  ready,
  selectVideoActivity,
  VideoActivity,
  VideosState,
} from "store/videos";
import useInterval from "utils/useInterval";
import styles from "./videos.module.css";

let missionTime = 0;

/**
 * Renders the part of the CODA interface that includes audio and video players and selectors
 */
export default function Videos() {
  // get query parameters asking for specific video sources
  // see https://nextjs.org/docs/routing/dynamic-routes
  // FYI: the syntax here is how you declare default parameters and types simultaneously for a destructured object with TS
  // see https://mariusschulz.com/blog/typing-destructured-object-parameters-in-typescript
  // get query parameters asking for specific video downlink sources
  const {
    query: { left = "1", right = "2" },
  }: {
    query: { left?: string; right?: string };
  } = useRouter();

  const store = useStore();
  const dispatch = useDispatch();
  const { videos, clock }: { videos: VideosState; clock: ClockState } = useSelector(
    (state) => state
  );

  let videoActivity = null as VideoActivity;

  if (Object.keys(videos.videos).length > 0) {
    videoActivity = selectVideoActivity(videos);
  }

  //downlink channels for left and right
  const [videoGroupLeft, setVideoGroupLeft] = useState(+left - 1);
  const [videoGroupRight, setVideoGroupRight] = useState(+right - 1);

  useEffect(() => {
    setVideoGroupLeft(+left - 1);
  }, [left]);

  useEffect(() => {
    setVideoGroupRight(+right - 1);
  }, [right]);

  // define the name of the players
  // the names of the players should match the keys in `store.videos.selectedGroups`
  const videoPlayerNames = ["left", "right"];
  const players = {
    left: useRef() as MutableRefObject<HTMLVideoElement>,
    right: useRef() as MutableRefObject<HTMLVideoElement>,
  };
  const [mutedLeft, setMutedLeft] = useState(true);
  const [mutedRight, setMutedRight] = useState(true);

  // metadata used below to detect whether current video fully loaded
  const [videoMetadataLeft, setVideoMetadataLeft] = useState(null);
  const [videoMetadataRight, setVideoMetadataRight] = useState(null);

  // video status indicators
  const [videoStatusLeft, setVideoStatusLeft] = useState(null);
  const [videoStatusRight, setVideoStatusRight] = useState(null);

  useEffect(() => {
    const videoIDLeft = videos.activeVideoFiles["left"];
    const videoIDRight = videos.activeVideoFiles["right"];
    if (
      videos.activeVideoFiles.left === "" ||
      !isSameDate(new Date(clock.applicationTime), new Date(videos.videos[videoIDLeft].start))
    ) {
      setVideoMetadataLeft(null);
    }
    if (
      videos.activeVideoFiles.right === "" ||
      !isSameDate(new Date(clock.applicationTime), new Date(videos.videos[videoIDRight].start))
    ) {
      setVideoMetadataRight(null);
    }
  }, [clock.applicationTime, videos.activeVideoFiles]);

  // this is the main loop where we (1) make sure the right video files are playing and (2) that they're synced with the timeline
  useInterval(() => {
    const { clock } = store.getState();
    const newMissionTime = getMissionTime(clock);

    /* don't do work if the time of the mission (in seconds) hasn't changed since the last time we checked
    but only if the clock is running. This stops one buffering video from essentially blocking
    beginning to buffer the other video */
    if (clock.isRunning) {
      if (newMissionTime === missionTime) {
        return;
      } else {
        missionTime = newMissionTime;
      }
    }

    // we can't update videos if we don't have videos
    if (!videoActivity) {
      return;
    }

    // perform video and timeline syncs against all video players
    videoPlayerNames.forEach((name: string) => {
      const group = name === "left" ? videoGroupLeft : videoGroupRight;
      const activeVideoFileID = videos.activeVideoFiles[name];
      const videosNextSecond = videoActivity[group][missionTime + 1];

      // (1) check for video changes
      let id = activeVideoFileID;

      // (1.1) if the timeline just jumped or the video files changed, make sure we start the right video
      // we always use element 0 of the videos available in this group for any given second (see videos.ts)
      if (videosNextSecond.length > 0 && activeVideoFileID !== videosNextSecond[0]) {
        // there is a different video for this group the next second! pick the highest priority video for this group. See store/videos.ts#videoSorter for how video files are sorted
        id = videosNextSecond[0];
      }

      if (videosNextSecond.length === 0) {
        // (1.2) check if no video is playing next second
        id = "";
      }

      // if the video needs to change, change it and bail. let the timeline catch up in the next second after the video loads
      if (id !== activeVideoFileID) {
        dispatch(pickVideoFile({ name, id }));

        //wipe out the metadata for this player so that aspect will be recalculated when the next video loads
        name === "left" ? setVideoMetadataLeft(null) : setVideoMetadataRight(null);

        return;
      }

      // (2) keep the video in sync with the timeline

      // (2.1) bail if no video element is loaded
      if (!players[name].current) {
        return;
      }

      const { currentTime } = players[name].current;

      // (2.2) make sure the video times are correct

      const currentlyPlayingVideo = videos.videos[videos.activeVideoFiles[name]];
      let videoStartOffset = 0;
      if (currentlyPlayingVideo) {
        videoStartOffset = missionTime - currentlyPlayingVideo.missionSecondsStart;
      }

      if (Math.abs(currentTime - videoStartOffset) > 1) {
        players[name].current.pause();
        players[name].current.currentTime = videoStartOffset;
      }
    });
  }, 50);

  /**
   * Renders the actual HTML5 video
   */
  const videoElement = (name: string) => {
    const videoID = videos.activeVideoFiles[name];
    const videoMetadata = name === "left" ? videoMetadataLeft : videoMetadataRight;
    let videoStatus = name === "left" ? videoStatusLeft : videoStatusRight;

    function setVideoStatus(name: string, status: string) {
      name === "left" ? setVideoStatusLeft(status) : setVideoStatusRight(status);
    }

    function setVidElementMetadata(name: string, vidElement: HTMLVideoElement) {
      const metaData = {
        videoHeight: vidElement.videoHeight,
        videoWidth: vidElement.videoWidth,
        duration: vidElement.duration,
      };
      name === "left" ? setVideoMetadataLeft(metaData) : setVideoMetadataRight(metaData);
    }

    // default video info
    let vidInfo = "";
    let videoURL = ""; //this empties the src attribute of the video and avoids trying to load empty url
    if (videoID !== "") {
      const video = videos.videos[videoID];
      videoURL = video.videoURL;
      vidInfo = video.description;
    } else {
      if (!videos.ready[name]) {
        // there is no video for right now, so don't block the clock
        if (!videos.ready[name]) {
          dispatch(ready(name));
        }
      }
    }

    if (
      // make sure the video is playing when the clock is running
      clock.isRunning &&
      players[name].current &&
      players[name].current.paused &&
      videos.ready[name]
    ) {
      // it is paused when it should be playing and video isn't buffering
      (async () => {
        try {
          await players[name].current.play();
        } catch (e) {
          // Swallow errors here because we have to try to play empty src
          // because HTML video won't unload a video when src is undefined
        }
      })();
    }

    if (players[name].current && !players[name].current.paused && !clock.isRunning) {
      // it is playing when it shouldn't be
      (async () => await players[name].current.pause())();
    }

    const muted = name === "left" ? mutedLeft : mutedRight;

    // Displays video background poster to depect novid, buffering,
    // or blank if video loaded or buffering during playback
    // videoMetadata used to determine whether a buffering event is happening on an already playing video
    // or a new loading event
    let posterClass = styles.playerPosterNovid;
    //hide noVid poster if video metadata has been loaded
    if (videoMetadata) {
      posterClass = "";
    }
    if (videoStatus === "buffering") {
      // if there is no videoMetadata then this is the buffering of a new video. Show loader.
      if (!videoMetadata) {
        posterClass = styles.playerPosterBuffering;
      } else {
        posterClass = "";
      }
    }

    // show IO error if a 400 error has been raised in the video player event handlers below
    let IOErrorCSS = {};
    if (videoStatus === "error" && videoURL !== "") {
      IOErrorCSS = { display: "block" };
    }

    return (
      <div
        key={`video_element__${name}`}
        className={`${styles.vidContainer} ${styles.vidContainer4by3}`}
      >
        <div className={`${styles.playerPoster} ${posterClass}`}>
          <div className={styles.IOError} style={IOErrorCSS}>
          Imagery Online Video Error
          </div>
        </div>
        <video
          ref={players[name]}
          className={styles.player}
          src={videoURL}
          muted={muted}
          autoPlay
          onCanPlay={() => {
            if (!videos.ready[name]) {
              dispatch(ready(name));
            }
          }}
          onEnded={() => {
            // ready up because we don't want a missing video to hold up the clock
            dispatch(ready(name));
          }}
          onWaiting={() => {
            if (videos.ready[name] && videoURL !== "") {
              dispatch(buffering(name));
              setVideoStatus(name, "buffering");
            }
          }}
          onPlaying={() => {
            setVideoStatus(name, "playing");
          }}
          onLoadedMetadata={(e) => {
            // Used to later determine whether a buffering event is happening on an already playing video
            // or a new loading event
            const vidElement = e.target as HTMLVideoElement;
            setVidElementMetadata(name, vidElement);
          }}
          onError={(e) => {
            const vidElement = e.target as HTMLVideoElement;
            if (!vidElement.error.message.includes("mpty")) {
              //if not 'src attribute is empty' - this eliminates raising an IO error on empty src
              setVideoStatus(name, "error");
              console.error(
                `video ${name} has thrown an error ${vidElement.error.code} - ${vidElement.error.message}`
              );
            } else {
              setVideoStatus(name, "novid");
            }
            //unblocking clock
            if (videos.ready[name] !== true) {
              dispatch(ready(name));
            }
          }}
        ></video>
        <div className={styles.vidOverlay}>
          <div className={styles.vidInfo}>{vidInfo}</div>
        </div>
      </div>
    );
  };

  const availableGroups = [0, 1, 2, 3, 4, 5, 6];

  const videoPlayer = (
    /** Identifies this video player so we know what group to play. It should match a key in `store.videos.selectedGroups` */
    name: string
  ) => {
    const group = name === "left" ? videoGroupLeft : videoGroupRight;
    const muted = name === "left" ? mutedLeft : mutedRight;
    const mutedClass = muted === true ? styles.unmute : styles.mute;

    let currentMissionTime = getMissionTime(clock);
    return (
      <div className={styles.vidPanel} key={`video_player__${name}`}>
        {availableGroups.map((g) => {
          let buttonClassStyle = styles.vidButton;
          if (g === group) {
            buttonClassStyle = `${buttonClassStyle} ${styles.selected}`;
          } else if (videoActivity && videoActivity[g][currentMissionTime].length > 0) {
            buttonClassStyle = `${buttonClassStyle} ${styles.active}`;
          }
          return (
            <button
              key={`vid${name}__button${g}`}
              type="button"
              className={buttonClassStyle}
              onClick={() => {
                if (name === "left") {
                  setVideoGroupLeft(g);
                } else {
                  setVideoGroupRight(g);
                }
              }}
            >
              {g < 6 ? `D/L ${g + 1}` : "non-D/L"}
            </button>
          );
        })}

        <div className={styles.soundBtnOutline}>
          <div
            className={`${styles.soundBtn} ${mutedClass}`}
            onClick={() => {
              name === "left" ? setMutedLeft(!mutedLeft) : setMutedRight(!mutedRight);
            }}
          ></div>
        </div>
        {videoElement(name)}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {videoPlayer("left")}
      {videoPlayer("right")}
    </div>
  );
}
