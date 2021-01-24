import { useRouter } from "next/router";
import { MutableRefObject, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ClockState, getMissionTime } from "store/clock";
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
import { paramsToObject } from "utils/formatting";

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
    query: { left = 1, right = 2 },
  }: {
    query: { left?: number; right?: number };
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
  const [leftVideo, setLeftVideo] = useState(left - 1);
  const [rightVideo, setRightVideo] = useState(right - 1);

  // get query parameters asking for specific video sources and store them in Redux
  // -1 default values are defined in videos.ts in the store initial state.
  // we use this to detect whether the query parameters have already been used in a previous component
  // render operation
  const router = useRouter();

  //router.query does not seem to include query params so we decode them ourselves
  const queryParamsString = router.asPath.split("?")[1];
  const urlParams = new URLSearchParams(queryParamsString);
  const entries = urlParams.entries(); //returns an iterator of decoded [key,value] tuples
  const params = paramsToObject(entries); //{abc:"foo",def:"[asf]",xyz:"5"}

  // console.log("left default before load: " + videos.selectedGroups.left);
  if (videos.selectedGroups.left === -1) {
    let selectedLeft = 0; //set the default of left video to DL1
    if ("left" in params) {
      selectedLeft = parseInt(params["left"]);
    }
    dispatch(pickGroup({ name: "left", group: selectedLeft }));
  }
  if (videos.selectedGroups.right === -1) {
    let selectedRight = 1; //set the default of right video to DL2
    if ("right" in params) {
      selectedRight = parseInt(params["right"]);
    }
    dispatch(pickGroup({ name: "right", group: selectedRight }));
  }

  // define the name of the players
  // the names of the players should match the keys in `store.videos.selectedGroups`
  const videoPlayerNames = ["left", "right"];
  const players = {
    left: useRef() as MutableRefObject<HTMLVideoElement>,
    right: useRef() as MutableRefObject<HTMLVideoElement>,
  };
  const [mutedLeft, setMutedLeft] = useState(true);
  const [mutedRight, setMutedRight] = useState(true);

  // metadata for video dimensions. Used to detect video aspect radio and adjust CSS accordingly
  const [videoMetadataLeft, setVideoMetadataLeft] = useState(null);
  const [videoMetadataRight, setVideoMetadataRight] = useState(null);

  // this is the main loop where we (1) make sure the right video files are playing and (2) that they're synced with the timeline
  useInterval(() => {
    const { clock } = store.getState();
    const newMissionTime = getMissionTime(clock);

    // don't do work if the time of the mission (in seconds) hasn't changed since the last time we checked
    if (newMissionTime === missionTime) {
      return;
    }
    missionTime = newMissionTime;

    // we can't update videos if we don't have videos
    if (!videoActivity) {
      return;
    }

    // perform video and timeline syncs against all video players
    videoPlayerNames.forEach((name: string) => {
      const group = name === "left" ? leftVideo : rightVideo;
      const activeVideoFileID = videos.activeVideoFiles[name];
      const videosNextSecond = videoActivity[group][missionTime + 1];

      // (1) check for video changes

      let id = activeVideoFileID;

      // (1.1) if the timeline just jumped or the video files changed, make sure we start the right video
      // we always use element 0 of the videos available in this group for any given second (see videos.ts)
      if (videosNextSecond.length > 0 && activeVideoFileID !== videosNextSecond[0]) {
        // there is a different video for this group the next second! pick the highest priority video for this group. See store/videos.ts#videoSorter for how video files are sorted
        id = videosNextSecond[0];
      } else if (
        // (1.2) check if no video is playing next second
        videosNextSecond.length === 0
      ) {
        id = "";
      }

      // if the video needs to change, change it and bail. let the timeline catch up in the next second after the video loads
      if (id !== activeVideoFileID) {
        dispatch(pickVideoFile({ name, id }));

        //wipe out the metadata for this player so that aspect will be recalculated when the next video loads
        if (name === "left") {
          setVideoMetadataLeft(null);
        } else {
          setVideoMetadataRight(null);
        }

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
        dispatch(buffering(name));
      }
    });
  }, 50);

  /**
   * Renders the actual HTML5 video
   */
  const videoElement = (name: string) => {
    const videoID = videos.activeVideoFiles[name];

    // default video info
    let videoURL = "";
    let vidInfo = "";
    if (videoID !== "") {
      const video = videos.videos[videoID];
      videoURL = video.videoURL;
      vidInfo = video.description;
    } else {
      if (!videos.ready[name]) {
        // there is no video for right now, so don't block the clock
        dispatch(ready(name));
      }
    }

    if (players[name].current && videoURL !== players[name].current.currentSrc) {
      // TODO: this is a problem: https://developers.google.com/web/updates/2017/06/play-request-was-interrupted
      players[name].current.load();
    }

    // make sure the video is playing when the clock is running
    if (
      clock.isRunning &&
      players[name].current &&
      players[name].current.paused &&
      videos.ready[name]
    ) {
      // it is paused when it should be playing
      (async () => {
        try {
          await players[name].current.play();
        } catch (e) {
          console.error(e);
        }
      })();
    }

    if (players[name].current && !players[name].current.paused && !clock.isRunning) {
      // it is playing when it shouldn't be
      (async () => await players[name].current.pause())();
    }

    const muted = name === "left" ? mutedLeft : mutedRight;

    let posterURL = "/images/test-pattern-bw_640.png";
    if (videos.status[name] === "buffering") {
      posterURL = "/images/eva_loader_bw.gif";
    }

    //uses videoMetadata state data to determine correct display aspect ratio of each video
    let aspectRatioClass = styles.vidContainer4by3;
    const videoMetadata = name === "left" ? videoMetadataLeft : videoMetadataRight;
    if (videoMetadata) {
      const aspectRatio = videoMetadata.videoHeight / videoMetadata.videoWidth;
      if (aspectRatio !== 0.75) {
        aspectRatioClass = styles.vidContainer16by9;
      }
    }

    return (
      <div key={`video_element__${name}`} className={`${styles.vidContainer} ${aspectRatioClass}`}>
        <video
          ref={players[name]}
          className={styles.player}
          muted={muted}
          src={videoURL}
          poster={posterURL}
          onCanPlay={() => {
            dispatch(ready(name));
          }}
          onEnded={() => {
            // ready up because we don't want a missing video to hold up the clock
            dispatch(ready(name));
          }}
          onWaiting={() => {
            if (videos.ready[name] && videoID !== "") {
              dispatch(buffering(name));
            }
          }}
          onLoadedMetadata={(e) => {
            const vidElement = e.target as HTMLVideoElement;
            vidElement;
            if (name === "left") {
              setVideoMetadataLeft({
                videoHeight: vidElement.videoHeight,
                videoWidth: vidElement.videoWidth,
              });
            } else {
              setVideoMetadataRight({
                videoHeight: vidElement.videoHeight,
                videoWidth: vidElement.videoWidth,
              });
            }
            console.log(
              "html vid metadata: " + vidElement.videoHeight + " width: " + vidElement.videoWidth
            );
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
    let mutedClass;
    if (name === "left") {
      mutedClass = mutedLeft === true ? styles.unmute : styles.mute;
    } else {
      mutedClass = mutedRight === true ? styles.unmute : styles.mute;
    }
    let currentMissionTime = getMissionTime(clock);
    return (
      <div className={styles.vidPanel} key={`video_player__${name}`}>
        {availableGroups.map((g) => {
          const group = name === "left" ? leftVideo : rightVideo;

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
                  setLeftVideo(g);
                  setVideoMetadataLeft(null);
                } else {
                  setRightVideo(g);
                  setVideoMetadataRight(null);
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
              if (name === "left") {
                setMutedLeft(!mutedLeft);
              } else {
                setMutedRight(!mutedRight);
              }
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
