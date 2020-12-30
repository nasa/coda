import { useRouter } from "next/router";
import { useDispatch, useSelector, useStore } from "react-redux";
import { getMissionTime, historySelector } from "store/clock";
import { pickVideoFile, selectVideoActivity, VideosState } from "store/videos";
import useInterval from "utils/useInterval";
import AudioPlayer from "./audio-player";
import VideoPlayer from "./video-player";

let missionTime = 0;

/**
 * Renders the part of the CODA interface that includes audio and video players and selectors
 */
function AVPanels() {
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
  const videos: VideosState = useSelector((state) => state.videos);

  const videoPlayerNames = ["left", "right"];

  const videoActivity = selectVideoActivity(videos);
  useInterval(() => {
    const { clock } = store.getState();
    const newMissionTime = getMissionTime(historySelector(clock));
    if (newMissionTime !== missionTime) {
      videoPlayerNames.forEach((name) => {
        const group = videos.selectedGroups[name];
        if (
          // check for video changes in the group between now and the next second
          videoActivity[group][missionTime] !==
          videoActivity[group][missionTime + 1]
        ) {
          let id = "";
          if (videoActivity[group][missionTime + 1].length > 0) {
            // there is a video for this group the next second! pick the highest priority one
            id = videoActivity[group][missionTime + 1][0];
          }
          dispatch(pickVideoFile({ name, id }));
        }
      });
    }
    missionTime = newMissionTime;
  }, 50);

  return (
    <div id="panelsContainer">
      <AudioPlayer />
      {videoPlayerNames.map((name, i) => (
        <VideoPlayer key={`video_player__${i}`} name={name} />
      ))}
    </div>
  );
}

export default AVPanels;
