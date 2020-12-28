import { createSelector, createSlice } from "@reduxjs/toolkit";
import { TimingData, VideoActivity, Videos, VideoItem } from "services/io";

export interface VideosState {
  videos: { [key: string]: VideoItem };
  gSelectedVidGroup: number;
}

export const initialState: VideosState = {
  videos: {},
  gSelectedVidGroup: null,
};

export const videoSlice = createSlice({
  name: "video",
  initialState,
  reducers: {},
});

// export const { initialize } = videoSlice.actions;

const videosSelector = (state) => state.videos;

export const selectVideoTimingData = createSelector(
  videosSelector,
  (videos: Videos) => {
    const timingData: TimingData = {};

    Object.keys(videos).forEach((v) => {
      const video = videos[v];
      // set the bounds on the video start and end times
      if (
        !timingData.video_earliestStart ||
        video.start.getTime() < timingData.video_earliestStart.getTime()
      ) {
        timingData.video_earliestStart = new Date(video.start.toUTCString());
      }
      if (
        !timingData.video_latestEnd ||
        video.end.getTime() > timingData.video_latestEnd.getTime()
      ) {
        timingData.video_latestEnd = new Date(video.end.toUTCString());
      }
    });

    timingData.EVA_duration_seconds =
      (+timingData.video_latestEnd - +timingData.video_earliestStart) / 1000;

    return timingData;
  }
);

/** Identify what videos are active at every second */
export const selectVideoActivity = createSelector(
  videosSelector,
  selectVideoTimingData,
  (videos, gTimingData): VideoActivity => {
    const gVideoActivityByGroupBySecond: VideoActivity = [];
    for (let group = 0; group <= 6; group++) {
      const groupSecondsArray: number[][] = [];
      for (
        let second = 0;
        second < gTimingData.EVA_duration_seconds;
        second++
      ) {
        const vidsThisGroupThisSecond: number[] = [];
        for (let i = 0; i < videos.length; i++) {
          if (
            videos[i].group === group &&
            second >= videos[i].missionSecondsStart &&
            second <= videos[i].missionSecondsEnd
          ) {
            vidsThisGroupThisSecond.push(i);
          }
        }
        let vidIndex;
        if (vidsThisGroupThisSecond.length > 0) {
          vidIndex =
            vidsThisGroupThisSecond[vidsThisGroupThisSecond.length - 1];
        } else {
          vidIndex = -1;
        }
        groupSecondsArray.push(vidIndex);
      }
      gVideoActivityByGroupBySecond.push(groupSecondsArray);
    }
    return gVideoActivityByGroupBySecond;
  }
);

export const selectVideoItems = createSelector(videosSelector, (videos) => {
  const gVideoItems: VideoItem[] = [];

  Object.keys(videos).forEach((v) => {
    gVideoItems.push(videos[v]);
  });

  // sorts by priority first, then duration second. Counterintuitively, this array is later used to choose the item with the highest array position for the preferred video stream for a given group and time.
  gVideoItems.sort(function (a: VideoItem, b: VideoItem) {
    return (
      +(a.priority > b.priority) ||
      +(a.priority === b.priority) - 1 ||
      +(a.durationSeconds > b.durationSeconds) ||
      +(a.durationSeconds === b.durationSeconds) - 1
    );
  });

  return gVideoItems;
});
