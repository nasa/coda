import { createSlice } from "@reduxjs/toolkit";

export const initialState: UserState = {
  user: {} as EmssUser,
  liveVideoEnabled: true,
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
  },
});

export const { setUser, setLiveVideoEnabled } = userSlice.actions;
