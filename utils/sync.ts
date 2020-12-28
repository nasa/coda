import {
  currentClockSelector,
  currentGMT,
  currentMissionTimeSeconds,
} from "store/clock";

export default function handleSync(GMT) {
  console.log(GMT);
}

export function checkVideoChange(state) {
  const {
    videos: { gSelectedVidGroup, gVideoActivityByGroupBySecond },
  } = state;

  const s = currentMissionTimeSeconds();

  // if video change this second
  for (var i = 0; i < gSelectedVidGroup.length; i++) {
    if (
      gVideoActivityByGroupBySecond[gSelectedVidGroup[i]][s] !==
      gVideoActivityByGroupBySecond[gSelectedVidGroup[i]][s + 1]
    ) {
      // TODO, set a video in redux
      // loadVideo(i, gSelectedVidGroup[i], s);
    }
  }
}
