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
}

export const initialPhotoFileState: PhotoFile = {
  id: "",
  description: "",
  lowResURL: "",
  highResURL: "",
  ioInfoURL: "",
  date_added: "",
  date_taken: "",
};

export const initialState: PhotosState = {
  photos: {},
  activePhoto: initialPhotoFileState,
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

// Deliver a sorted array of photos from the store
export const selectPhotoFiles = createSelector(
  photosSelector,
  (photos: { [key: string]: PhotoFile } = {}) => {
    const photosFiles = Object.keys(photos).map((i) => photos[i]);
    photosFiles.sort((a, b) => {
      return a.date_taken < b.date_taken ? -1 : a.date_taken > b.date_taken ? 1 : 0;
    });
    return photosFiles;
  }
);
