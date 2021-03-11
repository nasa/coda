import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import type { PhotoFile } from "services/io";
import { RootState } from ".";

const photoAdapter = createEntityAdapter<PhotoFile>();

export const initialPhotoFileState: PhotoFile = {
  id: "",
  description: "",
  lowResURL: "/coda/images/vintage_static.gif",
  highResURL: "",
  ioInfoURL: "",
  date_added: "",
  date_taken: "",
  dateTakenAppSeconds: 0,
};

export const initialState = photoAdapter.getInitialState({
  activePhoto: initialPhotoFileState,
  errorMessage: "",
  ready: false,
  photosLastChecked: "",
});

export const photosSelector = photoAdapter.getSelectors<RootState>((state) => state.photos);

export const photoSlice = createSlice({
  name: "photo",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    addPhotos: (state, action) => {
      photoAdapter.upsertMany(state, action);
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
