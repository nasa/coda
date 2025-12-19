import { createSlice } from "@reduxjs/toolkit";
import { appSecondsFromDateString } from "utils/formatting";

/** Ensure every audio file carries its derived appSeconds value */
function withAppSeconds(file: TbAudioFileConverted): TbAudioFileConverted {
  if (typeof file.appSeconds === "number") {
    return file;
  }

  const startDate = new Date(file.startTime);
  if (Number.isNaN(startDate.valueOf())) {
    return file;
  }

  return {
    ...file,
    appSeconds: appSecondsFromDateString(startDate.toISOString()),
  };
}

export const initialState: TalkybotState = {
  audioFiles: [],
  metadata: null,
};

export const talkybotSlice = createSlice({
  name: "talkybot",
  initialState,
  reducers: {
    /** Set talkybot audio files in the store */
    setTalkybotAudioFiles: (
      state,
      action: { payload: FetchResponse<{ date: string; audioFiles: TbAudioFileConverted[] }> }
    ) => {
      const incomingAudioFiles = action.payload.data?.audioFiles ?? [];
      state.audioFiles = incomingAudioFiles.map(withAppSeconds);
      state.metadata = action.payload.fetchMetadata;
    },
    clearTalkybotAudioFiles: (state) => {
      state.audioFiles = [];
      state.metadata = null;
    },
    /** Add or update a single audio file (upsert from talkybotS2sSocket updates) */
    upsertTalkybotAudioFile: (state, action: { payload: TbAudioFileConverted }) => {
      const newFile = withAppSeconds(action.payload);
      // Check if audioFile record already exists (by fileUuid)
      const existingIndex = state.audioFiles.findIndex(
        (audioFile: TbAudioFileConverted) => audioFile.fileUuid === newFile.fileUuid
      );
      if (existingIndex === -1) {
        // Insert in sorted order by startTime
        const insertIndex = state.audioFiles.findIndex(
          (audioFile: TbAudioFileConverted) =>
            new Date(audioFile.startTime) > new Date(newFile.startTime)
        );
        if (insertIndex === -1) {
          state.audioFiles.push(newFile);
        } else {
          state.audioFiles.splice(insertIndex, 0, newFile);
        }
      } else {
        // Update existing file
        state.audioFiles[existingIndex] = newFile;
      }
    },
    talkybotFetchError: (state, action: { payload: string }) => {
      state.metadata = {
        success: false,
        error: action.payload,
        timestamp: state.metadata?.timestamp || new Date().toISOString(),
      };
    },
  },
});

export const {
  setTalkybotAudioFiles,
  clearTalkybotAudioFiles,
  upsertTalkybotAudioFile,
  talkybotFetchError,
} = talkybotSlice.actions;
