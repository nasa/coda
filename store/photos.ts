import { createSelector, createSlice } from "@reduxjs/toolkit";
import type { Photos, PhotoFile } from "services/io";
import { isSameDate } from "./clock";

export interface PhotosState {
  /** Keyed by the ID of the photo file */
  photos: { [key: string]: PhotoFile };
  /** Message describing something that went wrong fetching photo metadata */
  errorMessage: string;
  ready: boolean;
}

export const initialState: PhotosState = {
  photos: {},
  errorMessage: "",
  ready: false,
};

const photosSelector = (state) => state.photos;

export const photoSlice = createSlice({
  name: "photo",
  initialState,
  reducers: {
    /** Add new video files to the store */
    addPhotos: (state, action: { payload: { photos: { [key: string]: PhotoFile } } }) => {
      state.photos = { ...state.photos, ...action.payload.photos };
      state.errorMessage = "";
      state.ready = true;
    },
    /** An error occured fetching photo metadata TODO: determine whether this is needed */
    fetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { addPhotos, fetchError } = photoSlice.actions;

// Probably totally unnecessary, but attempting to mimic how the videos store works
export const selectPhotoFiles = createSelector(
  photosSelector,
  (photos: { [key: string]: PhotoFile } = {}) => {
    const photosFiles = Object.keys(photos).map((i) => photos[i]);
    return photosFiles;
  }
);
