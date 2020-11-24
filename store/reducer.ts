export const initialState = {
  currentVideoIDs: {},
  currentPlayhead: 0,
};

/**
 * Clearinghouse for changing and sharing the global state
 */
export default function reducer(state, action) {
  // console.log(state, action);
  switch (action.type) {
    case "update_video":
      // change one of the currently playing videos
      const currentVideoIDs = state.currentVideoIDs;
      currentVideoIDs[action.payload.playerID] = action.payload.videoID;
      return Object.assign({}, state, { currentVideoIDs });
    default:
      throw new Error();
  }
}
