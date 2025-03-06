import { createSlice } from "@reduxjs/toolkit";
import { cleanCollectionsString } from "utils/formatting";

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
  loadingStatus: "loading",
  collectionFilters: [],
};

export const photoSlice = createSlice({
  name: "photo",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    addPhotos: (state, action: { payload: WrappedResponse<PhotoFile[]> }) => {
      state.photoFiles = action.payload.data || []; // null returned when retriever error
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
    setPhotoLoadingStatus: (state, action: { payload: LoadingStatus }) => {
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

export function buildPhotoCollections(photos: PhotoFile[]) {
  const collections: PhotoCollectionFilters[] = [];
  const uniqueList: string[] = [];
  for (let i = 0; i <= photos?.length; i++) {
    if (photos[i] !== undefined) {
      if (!uniqueList.includes(photos[i].collections)) {
        const collectionsObject: PhotoCollectionFilters = {
          fullList: photos[i].collections,
          display: cleanCollectionsString(photos[i].collections),
          selected: true,
        };
        collections.push(collectionsObject);
        uniqueList.push(photos[i].collections);
      }
    }
  }
  //sort collections alphabetically.
  collections.sort(function (a, b) {
    const valA = a.display.toUpperCase(); // ignore upper and lowercase
    const valB = b.display.toUpperCase(); // ignore upper and lowercase
    if (valA < valB) {
      return -1;
    }
    if (valA > valB) {
      return 1;
    }
    return 0;
  });
  return collections;
}
