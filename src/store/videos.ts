import memoize from "lodash/memoize";
import { createSlice } from "@reduxjs/toolkit";

export const initialState: VideosState = {
  videoFiles: [],
  responseMetadata: null,
  loadingStatus: "loading",
};

export const videoSlice = createSlice({
  name: "video",
  initialState,
  reducers: {
    /** Add new video files to the store */
    addVideos: (state, action: { payload: WrappedResponse<VideoFile[]> }) => {
      state.videoFiles = action.payload.data;
      state.responseMetadata = action.payload.responseMetadata;
    },

    /** Clear all videos from the store */
    clearVideos: (state) => {
      state.videoFiles = [];
      state.responseMetadata = null;
    },

    /** An error occured fetching video metadata */
    fetchError: (state, action: { payload: string }) => {
      const error = action.payload.replace(/key=.*&/, "key=[key]&");
      state.responseMetadata = { ...state.responseMetadata, error };
    },

    setVideoLoadingStatus: (state, action: { payload: LoadingStatus }) => {
      state.loadingStatus = action.payload;
    },
  },
});

export const { addVideos, clearVideos, fetchError, setVideoLoadingStatus } = videoSlice.actions;

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
