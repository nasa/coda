import {
  initialState,
  retryTalkybot,
  setTalkybotConnectionError,
  talkybotFetchError,
  talkybotSlice,
} from "./talkybot";

describe("Talkybot connection recovery", () => {
  it("allows repeated retries after a failed socket connection", () => {
    const failed = talkybotSlice.reducer(initialState, setTalkybotConnectionError("Disconnected"));
    const retry = talkybotSlice.reducer(failed, retryTalkybot());
    expect(retry.connectionError).toBeNull();
    expect(retry.retryCount).toBe(1);
    expect(talkybotSlice.reducer(retry, retryTalkybot()).retryCount).toBe(2);
  });

  it("reports a failed transcript fetch without discarding legacy overrides", () => {
    const state = {
      ...initialState,
      audioFiles: [{ fileUuid: "legacy", override: true } as TbAudioFileConverted],
    };
    const failed = talkybotSlice.reducer(state, talkybotFetchError("Sign in and retry"));
    expect(failed.metadata?.success).toBe(false);
    expect(failed.audioFiles).toEqual(state.audioFiles);
  });
});
