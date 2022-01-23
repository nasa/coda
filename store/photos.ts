import memoize from "lodash/memoize";
import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import { isSameDate } from "./playhead";
import { LoadingStatusEnum } from "utils/enums";

const photoAdapter = createEntityAdapter<PhotoFile>();

export const initialPhotoFileState: PhotoFile = {
  id: "",
  description: "",
  mediaLowResURL: "",
  mediaHighResURL: "",
  dataURL: "",
  dateAdded: "",
  datetimeTaken: "",
  datetimeTakenAppSeconds: 0,
  collection: null,
  collections: "",
};

export const initialState: PhotosEntityState = photoAdapter.getInitialState({
  activePhoto: initialPhotoFileState,
  ready: false,
  metadata: null,
  loadingStatus: LoadingStatusEnum.LOADING,
  collectionFilters: [],
});

export const photosSelectors = photoAdapter.getSelectors<PhotosEntityState>((state) => state);

export const photoSlice = createSlice({
  name: "photo",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    addPhotos: (state, action: { payload: WrappedResponse<PhotoFile[]> }) => {
      photoAdapter.removeAll(state);
      photoAdapter.upsertMany(state, action.payload.data);
      state.metadata = { ...state.metadata, ...action.payload.metadata };
      state.ready = true;
    },
    setActivePhoto: (state, action: { payload: PhotoFile }) => {
      state.activePhoto = action.payload;
    },
    /** An error occured fetching photo metadata TODO: determine whether this is needed */
    fetchError: (state, action: { payload: string }) => {
      const error = action.payload.replace(/key=.*&/, "key=[key]&");
      state.metadata = { ...state.metadata, error };
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
  setActivePhoto,
  fetchError,
  setPhotoLoadingStatus,
  setCollectionFilters,
} = photoSlice.actions;

/** Filters photos for a given day */
const _filterVisiblePhotos = (photos: PhotoFile[], date: Date): PhotoFile[] => {
  return photos.filter((photo) => {
    return isSameDate(new Date(photo.datetimeTaken), date);
  });
};

/** Return a list of all photos for a given day */
export const filterVisiblePhotos = memoize(
  _filterVisiblePhotos,
  (photos: PhotoFile[], date: Date) => `${photos.length}/${date.toISOString()}`
);
