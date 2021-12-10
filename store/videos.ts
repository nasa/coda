import memoize from "lodash/memoize";
import { createSlice, createEntityAdapter } from "@reduxjs/toolkit";
import { isSameDate } from "./playhead";
import { LoadingStatusEnum } from "utils/enums";

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
  metadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
  lastChecked: "",
});

export const videoSelectors = videoAdapter.getSelectors<VideosEntityState>((state) => state);

export const videoSlice = createSlice({
  name: "video",
  initialState,
  reducers: {
    // Used to store which DL is selected in the video players.
    // Needs to be in store because it is used in the share function.
    setVideoDownlink: (state, action: { payload: { frameID: number; downlink: number } }) => {
      state.downlinks[action.payload.frameID] = action.payload.downlink;
    },

    setVideoNonDownlinkID: (
      state,
      action: { payload: { frameID: number; nonDownlinkID: string } }
    ) => {
      state.nonDownlinkIDs[action.payload.frameID] = action.payload.nonDownlinkID;
    },

    /** Set the video file ID to play on a named `<VideoPlayer />` */
    setActiveVideoFile: (state, action: { payload: { frameID: number; videoID: string } }) => {
      state.activeVideoFiles[action.payload.frameID] = action.payload.videoID;
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
    addVideos: (state, action: { payload: WrappedResponse<VideoFile[]> }) => {
      videoAdapter.upsertMany(state, action.payload.data);
      state.metadata = action.payload.metadata;
      state.lastChecked = new Date().toISOString();
    },

    /** An error occured fetching video metadata */
    fetchError: (state, action: { payload: string }) => {
      const error = action.payload.replace(/key=.*&/, "key=[key]&");
      state.metadata = { ...state.metadata, error };
    },

    setVideoLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
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
  setVideoLoadingStatus,
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
  const startUTC = date.valueOf() / 1000;

  videos.forEach((video) => {
    for (let v = video.start; v <= Math.floor(video.end); v++) {
      // key in the form of "seconds-into-day/downlink"
      const key = `${v - startUTC}/${video.downlink}`;
      // value in the form of [videoID, ...]
      ret.set(key, [...(ret.get(key) ?? []), video.id]);
    }
  });

  return ret;
};

/**
 * Create a data structure that maps seconds and downlinks to videos. Each key is in the form of "second/downlink", eg. "86399/6", indicating a video playing at 23:59 on downlink 6. The value is a list of video IDs playing at that second. Missing keys represent "second/downlink" without any videos. Keys can be iterated in ascending chronological order, but downlink order is not guaranteed
 */
export const visibleVideosBySecond = memoize(
  _visibleVideosBySecond,
  (videos: VideoFile[], date: Date) => `${videos.length}/${date.toISOString()}`
);

/** Filters videos for start and end dates that overlap a given day */
const _filterVisibleVideos = (videos: VideoFile[], date: Date): VideoFile[] => {
  const startOfDay = date.valueOf() / 1000;
  const endOfDay = startOfDay + 86399;
  return videos.filter((video) => {
    return video.start < endOfDay && video.end > startOfDay;
  });
};

/** Return a list of all videos that cover some part of the day */
export const filterVisibleVideos = memoize(
  _filterVisibleVideos,
  (videos: VideoFile[], date: Date) => `${videos.length}/${date.toISOString()}`
);
