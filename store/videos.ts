import { createSlice, createEntityAdapter } from "@reduxjs/toolkit";
import type { EntityState } from "@reduxjs/toolkit";
import { createSelector } from "reselect";
import { isSameDate } from "./playhead";
import type { VideoFile } from "typings/io";

/** Info about videos from IO and the desired high-level state of the video players */
export type VideosEntityState = EntityState<VideoFile> & {
  /** Match the video player to a downlink, @see {VideoFile.downlink}. Keyed by the ID of the video player */
  downlinks: { [key: number]: number };
  /** ID of nonDownlinkVideoSelected */
  nonDownlinkIDs: { [key: number]: string };
  /** Match the video player to a video file ID, @see {VideoFile.id}. Keyed by the ID of the video player */
  activeVideoFiles: { [key: number]: string };
  /** Whether or not the videos are ready to be played and the timeline can run. Keyed by the ID of the video player */
  ready: { [key: number]: boolean };
  /** Message describing something that went wrong fetching video metadata */
  errorMessage: string;
  /** UTC string of the last time we hit IO */
  lastChecked: string;
};

const videoAdapter = createEntityAdapter<VideoFile>();

export const initialState: VideosEntityState = videoAdapter.getInitialState({
  downlinks: {
    1: 0,
    2: 1,
  },
  nonDownlinkIDs: {
    1: "",
    2: "",
  },
  activeVideoFiles: {
    1: "",
    2: "",
  },
  ready: {
    1: true,
    2: true,
  },
  errorMessage: "",
  lastChecked: "",
});

export const videoSelectors = videoAdapter.getSelectors<VideosEntityState>((state) => state);

export const videoSlice = createSlice({
  name: "video",
  initialState,
  reducers: {
    // Used to store which DL is selected in the video players.
    // Needs to be in store because it is used in the share function.
    setVideoDownlink: (state, action: { payload: { playerID: number; downlink: number } }) => {
      state.downlinks[action.payload.playerID] = action.payload.downlink;
    },

    setVideoNonDownlinkID: (
      state,
      action: { payload: { playerID: number; nonDownlinkID: string } }
    ) => {
      state.nonDownlinkIDs[action.payload.playerID] = action.payload.nonDownlinkID;
    },

    /** Set the video file ID to play on a named `<VideoPlayer />` */
    setActiveVideoFile: (state, action: { payload: { playerID: number; videoID: string } }) => {
      state.activeVideoFiles[action.payload.playerID] = action.payload.videoID;
    },

    /** Mark videos are ready to be played. The payload is the video player name */
    ready: (state, action: { payload: number }) => {
      state.ready[action.payload] = true;
    },

    /** Mark videos as not ready to be played. The payload is the video player name */
    buffering: (state, action: { payload: number }) => {
      state.ready[action.payload] = false;
    },

    /** Add new video files to the store */
    addVideos: (state, action) => {
      videoAdapter.upsertMany(state, action);
      state.lastChecked = new Date().toUTCString();
      state.errorMessage = "";
    },

    /** An error occured fetching video metadata */
    fetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const {
  setVideoDownlink,
  setVideoNonDownlinkID,
  setActiveVideoFile,
  ready,
  buffering,
  addVideos,
  fetchError,
} = videoSlice.actions;

/** Identify what videos are active at every second
 * this produces a nested array: [downlinks][missionSeconds][list of videos]
 * downlinks are downlink channels, currently 0 - 6 for ISS
 * missionSeconds starts at 0 and ends at the end of the day (currently 24 hours of seconds)
 * list of videos is an array of video names that are labeled in IO as having occurred on this downlink (downlink)
 * at this second. For downlink videos, we currently only ever use the first element in this array because the array is sorted by
 * longest video. The thought here is that the longest video in IO at any given time is probably the most reliable
 * copy of what was happening on a given downlink at a given time. This also sorts out the large amount of time
 * overlap across files in IO for a given downlink. For non-downlink videos we use this list to populate a display
 * of all non-downlink videos at a given time.
 *
 * Nested as:
 *
 * ```md
 * [ every downlink
 *   [ every second
 *       [ ID of every video that's playing ]
 *   ]
 * ]
 * ``` */
export type VideoActivity = string[][][];

export const selectVideoActivity = createSelector(
  videoSelectors.selectAll,
  (videos: VideoFile[]): VideoActivity => {
    const cSecondsIn24Hours = 86400;
    const res: VideoActivity = [];
    // iterate through the possible downlink numbers, which is only 0-6 right now
    for (let downlink = 0; downlink <= 6; downlink++) {
      const downlinkSecondsArray: string[][] = [];
      // capture every second of the mission
      for (let second = 0; second < cSecondsIn24Hours; second++) {
        // capture all the IDs of the video files that are playing for this downlink this second
        const vidsThisdownlinkThisSecond: string[] = [];
        videos.forEach((video) => {
          if (
            video.downlink === downlink &&
            second >= video.missionSecondsStart &&
            second <= video.missionSecondsEnd
          ) {
            vidsThisdownlinkThisSecond.push(video.id);
          }
        });
        downlinkSecondsArray.push(vidsThisdownlinkThisSecond);
      }
      res.push(downlinkSecondsArray);
    }
    return res;
  }
);

/** Quick check to see if we have _any_ videos from a given UTC date in our store */
export const haveVideosFromDate = (videos: VideoFile[], date: Date): boolean => {
  for (let v in videos) {
    if (isSameDate(new Date(videos[v].start), date)) {
      return true;
    }
  }
  return false;
};
