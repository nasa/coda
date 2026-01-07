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
  metadata: null,
  collectionFilters: [],
};

export const photoSlice = createSlice({
  name: "photo",
  initialState,
  reducers: {
    /** Add new photo files to the store */
    addPhotos: (state, action: { payload: FetchResponse<PhotoFile[]> }) => {
      state.photoFiles = action.payload.data || []; // null returned when retriever error
      state.metadata = action.payload.fetchMetadata;
      state.ready = true;
    },

    clearPhotos: (state) => {
      state.photoFiles = [];
      state.metadata = null;
      state.ready = false;
    },
    setActivePhoto: (state, action: { payload: PhotoFile }) => {
      state.activePhoto = action.payload;
    },
    /** An error occured fetching photo metadata TODO: determine whether this is needed */
    fetchError: (state, action: { payload: string }) => {
      const error = action.payload.replace(/key=.*&/, "key=[key]&");
      state.metadata = {
        success: false,
        error,
        timestamp: state.metadata?.timestamp || new Date().toISOString(),
      };
    },
    setCollectionFilters: (state, action: { payload: PhotoCollectionFilters[] }) => {
      state.collectionFilters = action.payload;
    },
  },
});

export const { addPhotos, clearPhotos, setActivePhoto, fetchError, setCollectionFilters } =
  photoSlice.actions;

export function buildPhotoCollections(photos: PhotoFile[]): PhotoCollectionFilters[] {
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
