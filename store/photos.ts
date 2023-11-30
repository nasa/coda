import { createSlice } from "@reduxjs/toolkit";
import { LoadingStatusEnum } from "utils/enums";

export const initialPhotoFileState: PhotoFile = {
  id: "",
  description: "",
  mediaLowResURL: "",
  mediaHighResURL: "",
  mediaThumbURL: "",
  dataURL: "",
  dateAdded: "",
  datetimeTaken: "",
  datetimeTakenAppSeconds: 0,
  collection: null,
  collections: "",
};

export const initialState: PhotosState = {
  photoFiles: [],
  activePhoto: initialPhotoFileState,
  ready: false,
  responseMetadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
  collectionFilters: [],
};

export const photoSlice = createSlice({
  name: "photo",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    addPhotos: (state, action: { payload: WrappedResponse<PhotoFile[]> }) => {
      state.photoFiles = action.payload.data;
      state.responseMetadata = { ...state.responseMetadata, ...action.payload.responseMetadata };
      state.ready = true;
    },

    clearPhotos: (state) => {
      state.photoFiles = [];
      state.responseMetadata = null;
      state.ready = false;
    },
    setActivePhoto: (state, action: { payload: PhotoFile }) => {
      state.activePhoto = action.payload;
    },
    /** An error occured fetching photo metadata TODO: determine whether this is needed */
    fetchError: (state, action: { payload: string }) => {
      const error = action.payload.replace(/key=.*&/, "key=[key]&");
      state.responseMetadata = { ...state.responseMetadata, error };
    },
    setPhotoLoadingStatus: (state, action: { payload: LoadingStatusEnum }) => {
      state.loadingStatus = action.payload;
    },
    setCollectionFilters: (state, action: { payload: PhotoCollectionFilters[] }) => {
      state.collectionFilters = action.payload;
    },
  },
});

export const {
  addPhotos,
  clearPhotos,
  setActivePhoto,
  fetchError,
  setPhotoLoadingStatus,
  setCollectionFilters,
} = photoSlice.actions;
