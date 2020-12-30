import { createSelector, createSlice } from "@reduxjs/toolkit";
import { Videos, VideoFile } from "services/io";

/** Info about videos from IO and the desired high-level state of the video players */
export interface VideosState {
  /** Keyed by the ID of the video, @see {VideoFile.id} */
  videos: { [key: string]: VideoFile };
  /** Match the video player to a group, @see {VideoFile.group}. Keyed by the name of the video player */
  selectedGroups: { [key: string]: number };
  /** Match the video player to a video file ID, @see {VideoFile.id}. Keyed by the name of the video player */
  activeVideoFiles: { [key: string]: string };
}

export const initialState: VideosState = {
  videos: {},
  selectedGroups: {
    left: 0,
    right: 1,
  },
  activeVideoFiles: {
    left: "",
    right: "",
  },
};

export const videoSlice = createSlice({
  name: "video",
  initialState,
  reducers: {
    /** Pick a video group to play on a named `<VideoPlayer />` */
    pickGroup: (
      state,
      action: { payload: { name: string; group: number } }
    ) => {
      state.selectedGroups[action.payload.name] = action.payload.group;
    },

    /** Set the video file ID to play on a named `<VideoPlayer />` */
    pickVideoFile: (
      state,
      action: { payload: { name: string; id: string } }
    ) => {
      state.activeVideoFiles[action.payload.name] = action.payload.id;
    },
  },
});

export const { pickGroup, pickVideoFile } = videoSlice.actions;

const videosSelector = (state) => state.videos;

/** High level information about the start and end of videos for an EVA */
export interface TimingData {
  video_earliestStart?: Date;
  video_latestEnd?: Date;
  EVA_duration_seconds?: number;
}

export const selectVideoTimingData = createSelector(
  videosSelector,
  (videos: Videos) => {
    const timingData: TimingData = {};

    Object.keys(videos).forEach((v) => {
      const video = videos[v];
      const start = new Date(video.start);
      const end = new Date(video.end);
      // set the bounds on the video start and end times
      if (
        !timingData.video_earliestStart ||
        start.getTime() < timingData.video_earliestStart.getTime()
      ) {
        timingData.video_earliestStart = new Date(start.toUTCString());
      }
      if (
        !timingData.video_latestEnd ||
        end.getTime() > timingData.video_latestEnd.getTime()
      ) {
        timingData.video_latestEnd = new Date(end.toUTCString());
      }
    });

    timingData.EVA_duration_seconds =
      (+timingData.video_latestEnd - +timingData.video_earliestStart) / 1000;

    return timingData;
  }
);

/**
 * Sorts by priority first, then duration second. This sorting is later used to choose the item with the highest array position for the preferred video stream for a given group and time.
 */
export const videoSorter = (a: VideoFile, b: VideoFile) => {
  return (
    +(a.priority < b.priority) ||
    +(a.priority === b.priority) ||
    +(a.durationSeconds < b.durationSeconds) ||
    +(a.durationSeconds === b.durationSeconds)
  );
};

/**
 * Get an array of video files sorted by priority and duration with mission timeframes
 */
export const selectVideoFiles = createSelector(
  videosSelector,
  selectVideoTimingData,
  (videos, timingData) => {
    const videoFiles: VideoFile[] = [];

    Object.keys(videos).forEach((v) => {
      const newVideoFile = Object.assign({}, videos[v]);
      newVideoFile.missionSecondsStart =
        (new Date(newVideoFile.start).getTime() -
          timingData.video_earliestStart.getTime()) /
        1000;
      newVideoFile.missionSecondsEnd =
        (new Date(newVideoFile.end).getTime() -
          timingData.video_earliestStart.getTime()) /
        1000;
      newVideoFile.durationSeconds =
        newVideoFile.missionSecondsEnd - newVideoFile.missionSecondsStart;

      videoFiles.push(newVideoFile);
    });

    videoFiles.sort(videoSorter);

    return videoFiles;
  }
);

/**
 * Nested as:
 *
 * ```md
 * [ every group
 *   [ every second
 *       [ ID of every video that's playing ]
 *   ]
 * ]
 * ``` */
export type VideoActivity = string[][][];

/** Identify what videos are active at every second */
export const selectVideoActivity = createSelector(
  // presorted video files
  selectVideoFiles,
  selectVideoTimingData,
  (videos: VideoFile[], timingData: TimingData): VideoActivity => {
    const res: VideoActivity = [];
    // iterate through the possible group numbers, which is only 0-6 right now
    for (let group = 0; group <= 6; group++) {
      const groupSecondsArray: string[][] = [];
      // capture every second of the mission
      for (let second = 0; second < timingData.EVA_duration_seconds; second++) {
        // capture all the IDs of the video files that are playing for this group this second
        const vidsThisGroupThisSecond: string[] = [];
        videos.forEach((video, i) => {
          if (
            video.group === group &&
            second >= video.missionSecondsStart &&
            second <= video.missionSecondsEnd
          ) {
            vidsThisGroupThisSecond.push(video.id);
          }
        });
        groupSecondsArray.push(vidsThisGroupThisSecond);
      }
      res.push(groupSecondsArray);
    }
    return res;
  }
);
