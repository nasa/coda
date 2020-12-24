export type VideoPlayerState = {
  playerID: number;
  videoSource: number;
};

/**
 * The default state when the application first loads
 */
export const initialState: {
  currentVideos:
    | {
        [key: number]: VideoPlayerState;
      }
    | {};
  currentPlayhead: number;
  currentMissionTimeSeconds: number;
} = {
  currentVideos: {},
  currentPlayhead: 0,
  currentMissionTimeSeconds: 0,
};

/**
 * Clearinghouse for changing and sharing the global state
 */
export default function reducer(state, action) {
  switch (action.type) {
    case "initialize_videos":
      return Object.assign({}, state, { currentVideos: action.payload });
    case "update_video":
      // change one of the currently playing videos
      const currentVideos = state.currentVideos;
      currentVideos[action.payload.playerID] = action.payload.videoID;
      return Object.assign({}, state, { currentVideos });
    case "jump_to_time":
      return Object.assign({}, state, { currentPlayhead: action.payload });
    default:
      throw new Error();
  }
}
