import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import type { PhotoFile } from "services/io";
import { RootState } from ".";

export interface PhotosState {
  activePhoto: PhotoFile;
  /** Message describing something that went wrong fetching photo metadata */
  errorMessage: string;
  dateTakenAppSeconds: 0;
  ready: boolean;
  photosLastChecked: string;
  collectionFilters: CollectionFilters[];
}

export interface CollectionFilters {
  fullList: string;
  display: string;
  selected: boolean;
}

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
  collections_string: "",
  collections_string_pretty: "",
};

export const initialState = photoAdapter.getInitialState({
  activePhoto: initialPhotoFileState,
  errorMessage: "",
  ready: false,
  photosLastChecked: "",
  collectionFilters: [],
});

export const photosSelectors = photoAdapter.getSelectors<RootState>((state) => state.photos);

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
    setCollectionFilters: (state, action: { payload: CollectionFilters[] }) => {
      state.collectionFilters = action.payload;
    },
  },
});

export const { addPhotos, setActivePhoto, setCollectionFilters, fetchError } = photoSlice.actions;
