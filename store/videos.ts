import { createSelector, createSlice } from "@reduxjs/toolkit";
import type { Videos, VideoFile } from "services/io";

/** Info about videos from IO and the desired high-level state of the video players */
export interface VideosState {
  /** Keyed by the ID of the video, @see {VideoFile.id} */
  videos: { [key: string]: VideoFile };
  /** Match the video player to a group, @see {VideoFile.group}. Keyed by the name of the video player */
  selectedGroups: { [key: string]: number };
  /** Match the video player to a video file ID, @see {VideoFile.id}. Keyed by the name of the video player */
  activeVideoFiles: { [key: string]: string };
  /** Whether or not the videos are ready to be played and the timeline can run. Keyed by the name of the video player */
  ready: { [key: string]: boolean };
  /** Message describing something that went wrong fetching video metadata */
  errorMessage: string;
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
  ready: {
    left: true,
    right: true,
  },
  errorMessage: "",
};

export const videoSlice = createSlice({
  name: "video",
  initialState,
  reducers: {
    /** Pick a video group to play on a named `<VideoPlayer />` */
    pickGroup: (state, action: { payload: { name: string; group: number } }) => {
      state.selectedGroups[action.payload.name] = action.payload.group;
    },

    /** Set the video file ID to play on a named `<VideoPlayer />` */
    pickVideoFile: (state, action: { payload: { name: string; id: string } }) => {
      state.activeVideoFiles[action.payload.name] = action.payload.id;
    },

    /** Mark videos are ready to be played. The payload is the video player name */
    ready: (state, action: { payload: string }) => {
      state.ready[action.payload] = true;
    },

    /** Mark videos as not ready to be played. The payload is the video player name */
    buffering: (state, action: { payload: string }) => {
      state.ready[action.payload] = false;
    },
  },
});

export const { pickGroup, pickVideoFile, ready, buffering } = videoSlice.actions;

const videosSelector = (state) => state.videos;

/** High level information about the start and end of videos for an EVA */
export interface TimingData {
  video_earliestStart: Date;
  video_latestEnd: Date;
  EVA_duration_seconds: number;
}

/**
 * Calculate start, end, and duration of the EVA based on video data
 */
export const generateTimingData = (videos: Videos): TimingData => {
  const timingData: TimingData = {
    video_earliestStart: null,
    video_latestEnd: null,
    EVA_duration_seconds: 0,
  };

  //Always start at 00:00:00Z and end at 23:59:59Z

  //get the date from the first video
  let firstVideoKey = Object.keys(videos)[0];
  //FIXME: figure out why typescript sees this as a string half the time and a date the other half depending on reload (or just leave it)
  // see: https://stackoverflow.com/questions/32156823/typeerror-formats-datetimestring-toisostring-is-not-a-function
  const stringStartDate = videos[firstVideoKey].start.toString();

  let EVADay = new Date(stringStartDate).toISOString().substring(0, 10);
  timingData.video_earliestStart = new Date(EVADay + "T00:00:00Z");
  timingData.video_latestEnd = new Date(EVADay + "T23:59:59Z");

  timingData.EVA_duration_seconds =
    (+timingData.video_latestEnd - +timingData.video_earliestStart) / 1000;

  return timingData;
};

export const selectVideoTimingData = createSelector(videosSelector, generateTimingData);

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
 * Assing the mission start, mission end, and durations to videos
 */
export const assignStartEnd = (videos: Videos, timingData: TimingData) => {
  return Object.fromEntries(
    Object.keys(videos).map((v) => {
      const newVideoFile = Object.assign({}, videos[v]);
      newVideoFile.missionSecondsStart =
        (new Date(newVideoFile.start).getTime() - timingData.video_earliestStart.getTime()) / 1000;
      newVideoFile.missionSecondsEnd =
        (new Date(newVideoFile.end).getTime() - timingData.video_earliestStart.getTime()) / 1000;
      newVideoFile.durationSeconds =
        newVideoFile.missionSecondsEnd - newVideoFile.missionSecondsStart;

      return [v, newVideoFile];
    })
  );
};

/**
 * Get an array of video files sorted by priority and duration with mission timeframes
 */
export const selectVideoFiles = createSelector(videosSelector, (videos) => {
  const videoFiles = Object.keys(videos).map((v) => videos[v]);
  videoFiles.sort(videoSorter);
  return videoFiles;
});

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

/** Identify what videos are active at every second
 * this produces a nested array: [groups][missionSeconds][list of videos]
 * groups are downlink channels, currently 0 - 6 for ISS
 * missionSeconds starts at 0 and ends at the end of the day (currently 24 hours of seconds)
 * list of videos is an array of video names that are labeled in IO as having occurred on this group (downlink)
 * at this second. We currently only ever use the first element in this array because the array is sorted by
 * longest video. The thought here is that the longest video in IO at any given time is probably the most reliable
 * copy of what was happening on a given downlink at a given time. This also sorts out the large amount of time
 * overlap across files in IO for a given downlink. *
 */
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
