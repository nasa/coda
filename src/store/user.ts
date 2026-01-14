import { createSlice } from "@reduxjs/toolkit";

export const initialState: UserState = {
  user: {} as EmssUser,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: { payload: EmssUser }) => {
      state.user = action.payload;
    },
  },
});

export const { setUser } = userSlice.actions;
