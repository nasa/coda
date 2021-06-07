import memoize from "lodash/memoize";
import { createSlice, createEntityAdapter } from "@reduxjs/toolkit";
import type { EntityState } from "@reduxjs/toolkit";
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

/** Quick check to see if we have _any_ videos from a given UTC date in our store */
export const haveVideosFromDate = (videos: VideoFile[], date: Date): boolean => {
  for (let v in videos) {
    if (isSameDate(new Date(videos[v].start), date)) {
      return true;
    }
    if (isSameDate(new Date(videos[v].end), date)) {
      return true;
    }
  }
  return false;
};

/** Map seconds and downlinks to videos */
const _visibleVideosBySecond = (videos: VideoFile[], date: Date): Map<string, string[]> => {
  const ret = new Map<string, string[]>();
  let videoQueue = videos.slice();
  const startUTC = date.valueOf() / 1000;

  // iterate through all the UTC seconds for the day
  for (let s = startUTC; s < startUTC + 86400; s++) {
    // bail if there are no more videos to look at
    if (videoQueue.length === 0) {
      break;
    }

    let indicesToRemove = [];
    for (let v = 0; v < videoQueue.length; v++) {
      const video = videoQueue[v];
      if (s > video.start && s < video.end) {
        const key = `${s - startUTC}/${video.downlink}`;
        // the video is playing at this time
        // set or push a new ID to `{ second: [video ID] }`
        ret.set(key, [...(ret.get(key) ?? []), video.id]);
      } else if (s > video.end) {
        // the video has already ended. no reason to ever look at it again
        indicesToRemove.push(v);
      }
    }

    // actually remove videos that have ended
    videoQueue = videoQueue.filter((_v, i) => !indicesToRemove.includes(i));
  }

  return ret;
};

/**
 * Create a data structure that maps seconds and downlinks to videos. Each key is in the form of "second/downlink", eg. "86399/6", indicating a video playing at 23:59 on downlink 6. The value is a list of video IDs playing at that second. Missing keys represent "second/downlink" without any videos. Keys can be iterated in ascending chronological order, but downlink order is not guaranteed
 */
export const visibleVideosBySecond = memoize(_visibleVideosBySecond);

/** Filters videos for start and end dates that overlap a given day */
const _filterVisibleVideos = (videos: VideoFile[], date: Date): VideoFile[] => {
  const startOfDay = date.valueOf() / 1000;
  const endOfDay = startOfDay + 86399;
  return videos.filter((video) => {
    return video.start < endOfDay && video.end > startOfDay;
  });
};

/** Return a list of all videos that cover some part of the day */
export const filterVisibleVideos = memoize(_filterVisibleVideos);
