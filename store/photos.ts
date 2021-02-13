import { createSelector, createSlice } from "@reduxjs/toolkit";
import type { Photos, PhotoFile } from "services/io";
import { isSameDate } from "./clock";

/** Info about photos from IO and the desired high-level state of the video players */
export interface PhotosState {
  /** Keyed by the ID of the video file, @see {VideoFile.id} */
  photos: { [key: string]: PhotoFile };
  /** Message describing something that went wrong fetching photo metadata */
  errorMessage: string;
}

export const initialState: PhotosState = {
  photos: {},
  errorMessage: "",
};

export const photoSlice = createSlice({
  name: "photo",
  initialState,
  reducers: {
    /** Add new video files to the store */
    addPhotos: (state, action: { payload: { photos: { [key: string]: PhotoFile } } }) => {
      state.photos = { ...state.photos, ...action.payload.photos };
      state.errorMessage = "";
    },
    /** An error occured fetching photo metadata TODO: determine whether this is needed */
    fetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { addPhotos, fetchError } = photoSlice.actions;
