import configureMockStore, { MockStore } from "redux-mock-store";
import {
  clockSlice,
  currentClockSelector,
  initialState,
  start,
} from "store/clock";

describe("store/clockSlice", () => {
  const mockStore = configureMockStore();
  let store: MockStore;

  beforeEach(() => {
    store = mockStore(initialState);
  });

  describe("start", () => {
    it("action should send the current time", () => {
      const gmt = new Date();
      const { type, payload } = start(gmt);
      expect(type).toEqual("clock/start");
      expect(payload).toEqual(gmt);
    });

    it("reducer should set the current time to a GMT and start the clock", () => {
      const gmt = new Date(1955, 11, 5);
      const action = start(gmt);
      const {
        history: [{ GMT, localTime, go }],
      } = clockSlice.reducer(initialState, action);

      expect(go).toBeTruthy();
      expect(GMT).toEqual(gmt);
      // just make sure the localTime is within the last second
      expect(new Date(localTime).getTime() / 1000).toBeCloseTo(
        new Date().getTime() / 1000
      );
    });

    it("currentClockSelector should give the last user action", () => {
      let s = clockSlice.reducer(initialState, start(new Date()));
      s = clockSlice.reducer(s, start(new Date()));
      s = clockSlice.reducer(s, start(new Date()));

      const gmt = new Date(1955, 11, 5);
      const action = start(gmt);
      s = clockSlice.reducer(s, action);

      expect(s.history.length).toEqual(4);

      const { GMT } = currentClockSelector(s);

      expect(GMT.getTime() / 1000).toBeCloseTo(gmt.getTime() / 1000);
    });

    it("currentClockSelector returns null when there are no user actions", () => {
      const current = currentClockSelector(initialState);
      expect(current).toBeNull();
    });
  });
});
