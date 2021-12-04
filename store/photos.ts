import memoize from "lodash/memoize";
import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import type { EntityState } from "@reduxjs/toolkit";
import type { PhotoFile, ResMetadata, WrappedResponse } from "typings";
import { isSameDate } from "./playhead";

export type PhotosEntityState = EntityState<PhotoFile> & {
  activePhoto: PhotoFile;
  ready: boolean;
  metadata: ResMetadata;
  lastChecked: string;
  collectionFilters: CollectionFilters[];
};

export interface CollectionFilters {
  fullList: string;
  display: string;
  selected: boolean;
}

const photoAdapter = createEntityAdapter<PhotoFile>();

export const initialPhotoFileState: PhotoFile = {
  id: "",
  description: "",
  mediaLowResURL: "/images/vintage_static.gif",
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
  lastChecked: "",
  collectionFilters: [],
});

export const photosSelectors = photoAdapter.getSelectors<PhotosEntityState>((state) => state);

export const photoSlice = createSlice({
  name: "photo",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    addPhotos: (state, action: { payload: WrappedResponse<PhotoFile[]> }) => {
      photoAdapter.upsertMany(state, action.payload.data);
      state.metadata = action.payload.metadata;
      state.lastChecked = new Date().toISOString();
      state.ready = true;
    },
    setActivePhoto: (state, action: { payload: PhotoFile }) => {
      state.activePhoto = action.payload;
    },
    /** An error occured fetching photo metadata TODO: determine whether this is needed */
    fetchError: (state, action: { payload: string }) => {
      state.metadata.error = action.payload;
    },
    setCollectionFilters: (state, action: { payload: CollectionFilters[] }) => {
      state.collectionFilters = action.payload;
    },
  },
});

export const { addPhotos, setActivePhoto, setCollectionFilters, fetchError } = photoSlice.actions;

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
