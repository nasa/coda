import { createSlice } from "@reduxjs/toolkit";

export const initialState: UserState = {
  user: {} as EmssUser,
  liveVideoEnabled: true,
  restrictedVideoOverrideActive: false,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: { payload: EmssUser }) => {
      state.user = action.payload;
    },
    setLiveVideoEnabled: (state, action: { payload: boolean }) => {
      state.liveVideoEnabled = action.payload;
    },
    setRestrictedVideoOverrideActive: (state, action: { payload: boolean }) => {
      state.restrictedVideoOverrideActive = action.payload;
    },
  },
});

export const { setUser, setLiveVideoEnabled, setRestrictedVideoOverrideActive } = userSlice.actions;
