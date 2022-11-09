import {
  playheadSlice,
  initialState,
  run,
  halt,
  changeTime,
  changeDate,
  tick,
  mmddyy,
} from "store/playhead";

describe("store/playheadSlice", () => {
  describe("tick", () => {
    it("should increment the time by 1", () => {
      const seconds = 617;
      const action = tick();
      expect(action.type).toEqual("playhead/tick");

      const store = playheadSlice.reducer({ ...initialState, seconds }, action);
      expect(store.seconds).toEqual(seconds + 1);
    });
  });

  describe("changeDate", () => {
    it("should set the current application date to 00:00:00 of the selected date", () => {
      const utc = new Date(Date.UTC(2020, 6, 20, 23, 4, 1)).toISOString();
      const { type, payload } = changeDate(utc);
      expect(type).toEqual("playhead/changeDate");
      expect(payload).toEqual(utc);

      const { date } = playheadSlice.reducer(initialState, { type, payload });
      // @ts-expect-error - missing jest type "toHappenAround"
      expect(new Date(date)).toHappenAround(new Date(Date.UTC(2020, 6, 20, 0, 0, 0)));
    });
  });

  describe("changeTime", () => {
    it("should set the current application time within the date", () => {
      const { type, payload } = changeTime(10);
      expect(type).toEqual("playhead/changeTime");
      expect(payload).toEqual(10);

      const { seconds } = playheadSlice.reducer(initialState, { type, payload });
      expect(seconds).toEqual(10);
    });
  });

  describe("run", () => {
    it("should start the playhead", () => {
      const action = run();
      expect(action.type).toEqual("playhead/run");
      expect(action.payload).toBeFalsy();

      const { isRunning } = playheadSlice.reducer(initialState, action);
      expect(isRunning).toEqual(true);
    });
  });

  describe("halt", () => {
    it("should stop the playhead", () => {
      const action = halt();
      expect(action.type).toEqual("playhead/halt");
      expect(action.payload).toBeFalsy();

      const { isRunning } = playheadSlice.reducer(initialState, action);
      expect(isRunning).toEqual(false);
    });
  });
});

describe("date functions", () => {
  it("should return mmddyy", () => {
    let testDate = new Date(Date.UTC(2015, 0, 3));
    expect(mmddyy(testDate)).toEqual("010315");

    testDate.setUTCDate(25);
    testDate.setUTCMonth(11);
    expect(mmddyy(testDate)).toEqual("122515");
  });
});
