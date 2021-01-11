import { useRouter } from "next/router";
import { MutableRefObject, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ClockState, getMissionTime } from "store/clock";
import {
  buffering,
  pickGroup,
  pickVideoFile,
  ready,
  selectVideoActivity,
  VideosState,
} from "store/videos";
import useInterval from "utils/useInterval";
import styles from "./videos.module.css";

const noVidURL = "https://coda-dev.fit.nasa.gov/CODA_data/novid.mp4";
let missionTime = 0;

/**
 * Renders the part of the CODA interface that includes audio and video players and selectors
 */
function Videos() {
  // get query parameters asking for specific video sources
  // see https://nextjs.org/docs/routing/dynamic-routes
  // FYI: the syntax here is how you declare default parameters and types simultaneously for a destructured object with TS
  // see https://mariusschulz.com/blog/typing-destructured-object-parameters-in-typescript
  const {
    query: { group1 = null, group2 = null },
  }: {
    query: { group1?: number; group2?: number };
  } = useRouter();

  const store = useStore();
  const dispatch = useDispatch();
  const { videos, clock }: { videos: VideosState; clock: ClockState } = useSelector(
    (state) => state
  );

  // TODO: go from video to no video, switch videos at same time
  // why aren't the videos running when the app loads?

  // define the name of the players
  // the names of the players should match the keys in `store.videos.selectedGroups`
  const videoPlayerNames = ["left", "right"];
  // creates `{name: playerRef}` pairs for each HTML5 video player
  const players = {
    left: useRef() as MutableRefObject<HTMLVideoElement>,
    right: useRef() as MutableRefObject<HTMLVideoElement>,
  };

  const videoActivity = selectVideoActivity(videos);

  // this is the main loop where we (1) make sure the right video files are playing and (2) that they're synced with the timeline
  useInterval(() => {
    const { clock } = store.getState();
    const newMissionTime = getMissionTime(clock);

    // don't do work if the time of the mission (in seconds) hasn't changed since the last time we checked
    if (newMissionTime === missionTime) {
      return;
    }
    missionTime = newMissionTime;

    // perform video and timeline syncs against all video players
    videoPlayerNames.forEach((name) => {
      const group = videos.selectedGroups[name];
      const activeVideoFileID = videos.activeVideoFiles[name];
      const videosNextSecond = videoActivity[group][missionTime + 1];

      // (1) check for video changes

      let id = activeVideoFileID;

      // (1.1) if the timeline just jumped or the video files changed, make sure we start the right video
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
        dispatch(buffering(name));
        return;
      }

      // (2) keep the video in sync with the timeline

      // (2.1) bail if no video is loaded
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
  const videoElement = (name: string, i: number) => {
    const videoID = videos.activeVideoFiles[name];

    // default video info
    let videoURL = noVidURL;
    let downlinkDisplay = "No video available";
    let vidInfo = "";
    if (videoID !== "") {
      const video = videos.videos[videoID];
      videoURL = video.videoURL;
      vidInfo = video.description;
      downlinkDisplay = video.content;
    }

    if (players[name].current && videoURL !== players[name].current.currentSrc) {
      // TODO: this is a problem: https://developers.google.com/web/updates/2017/06/play-request-was-interrupted
      players[name].current.load();
    }

    // make sure the video is playing when the clock is running
    if (players[name].current && players[name].current.paused && clock.isRunning) {
      (async () => await players[name].current.play())();
    }

    return (
      <div key={`video_element__${i}`} className={styles.foo}>
        {/* <div id="vidTitle0" className={styles.vidTitle}>
          {downlinkDisplay}
        </div> */}
        <div className={styles.vidContainer}>
          <video
            ref={players[name]}
            className={styles.player}
            controls
            muted
            onCanPlay={() => dispatch(ready(name))}
            onPause={() => dispatch(buffering(name))}
            onWaiting={() => dispatch(buffering(name))}
          >
            <source src={videoURL} />
          </video>
          <div className={styles.vidOverlay}>
            <div className={styles.vidInfo}>{vidInfo}</div>
          </div>
        </div>
      </div>
    );
  };

  const availableGroups = [0, 1, 2, 3, 4, 5, 6];

  const videoPlayer = (
    /** Identifies this video player so we know what group to play. It should match a key in `store.videos.selectedGroups` */
    name: string,
    i: number
  ) => (
    <div className={styles.vidPanel} key={`video_player__${name}`}>
      <div>
        {availableGroups.map((g) => {
          return (
            <button
              key={`vid${name}__button${g}`}
              type="button"
              className={`${styles.vidButton} 
              ${g === videos.selectedGroups[name] && styles.selected} 
              ${
                videoActivity[videos.selectedGroups[name]].length > 0 && styles.active
              } //TODO: subscribe this to clock
              ${g === 0 && styles.first}
              ${g === 6 && styles.last}
              `}
              onClick={() => dispatch(pickGroup({ name, group: g }))}
            >
              {g < 6 ? `D/L ${g + 1}` : "non-D/L"}
            </button>
          );
        })}
      </div>
      {videoElement(name, i)}
    </div>
  );

  return (
    <div className={styles.container}>
      {videoPlayer("left", 0)}
      {videoPlayer("right", 1)}
    </div>
  );
}

export default Videos;
