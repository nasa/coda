import { createSelector, createSlice } from "@reduxjs/toolkit";
import type { PhotoFile } from "services/io";
import { isSameDate } from "./clock";

export interface PhotosState {
  /** Keyed by the ID of the photo file */
  photos: { [key: string]: PhotoFile };
  activePhoto: PhotoFile;
  /** Message describing something that went wrong fetching photo metadata */
  errorMessage: string;
  ready: boolean;
  /** UTC string of the last time we hit IO */
  photosLastChecked: string;
}

export const initialPhotoFileState: PhotoFile = {
  id: "",
  description: "",
  lowResURL: "/coda/images/vintage_static.gif",
  highResURL: "",
  ioInfoURL: "",
  date_added: "",
  date_taken: "",
  date_takenAppSeconds: 0,
};

export const initialState: PhotosState = {
  photos: {},
  activePhoto: initialPhotoFileState,
  errorMessage: "",
  ready: false,
  photosLastChecked: "",
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
      state.photosLastChecked = new Date().toUTCString();
      state.ready = true;
    },
    setActivePhoto: (state, action: { payload: PhotoFile }) => {
      state.activePhoto = action.payload;
    },
    /** An error occured fetching photo metadata TODO: determine whether this is needed */
    fetchError: (state, action: { payload: string }) => {
      state.errorMessage = action.payload;
    },
  },
});

export const { addPhotos, setActivePhoto, fetchError } = photoSlice.actions;

// Deliver an array of photos from the store
export const selectPhotoFiles = createSelector(
  photosSelector,
  (photos: { [key: string]: PhotoFile } = {}) => {
    console.log("Making new selectPhotoFiles array");
    const photosFiles = Object.keys(photos).map((i) => photos[i]);
    // sorting no longer required due to improved IO chunking in io.ts
    // photosFiles.sort((a, b) => {
    //   return a.date_taken < b.date_taken ? -1 : a.date_taken > b.date_taken ? 1 : 0;
    // });
    return photosFiles;
  }
);
