import {
  clockSlice,
  ClockState,
  initialState,
  run,
  halt,
  changeTime,
  changeDate,
  tick,
} from "store/clock";

// adds handy matchers for comparing clock times
// see typings/index.d.ts for the TS interface
expect.extend({
  toHappenAround(x: Date, y: Date, z: string) {
    const received = x.getTime();
    const expected = y.getTime();
    return {
      pass: Math.abs(received / 1000 - expected / 1000) < 1,
      message: () => `Received time ${x} is not within 1 second of ${y}${z ? ` ${z}` : ""}`,
    };
  },
});

describe("store/clockSlice", () => {
  describe("tick", () => {
    it("should increment the time by 1", () => {
      const time = 617;
      const action = tick();
      expect(action.type).toEqual("clock/tick");

      const store = clockSlice.reducer({ ...initialState, time }, action);
      expect(store.time).toEqual(time + 1);
    });
  });

  describe("changeDate", () => {
    it("should set the current application date to 00:00:00 of the selected date", () => {
      const utc = new Date(Date.UTC(2020, 6, 20, 23, 4, 1)).toISOString();
      const { type, payload } = changeDate(utc);
      expect(type).toEqual("clock/changeDate");
      expect(payload).toEqual(utc);

      const { date } = clockSlice.reducer(initialState, { type, payload });
      expect(new Date(date)).toHappenAround(new Date(Date.UTC(2020, 6, 20, 0, 0, 0)));
    });
  });

  describe("changeTime", () => {
    it("should set the current application time within the date", () => {
      const { type, payload } = changeTime(10);
      expect(type).toEqual("clock/changeTime");
      expect(payload).toEqual(10);

      const { time } = clockSlice.reducer(initialState, { type, payload });
      expect(time).toEqual(10);
    });
  });

  describe("run", () => {
    it("should start the clock", () => {
      const action = run();
      expect(action.type).toEqual("clock/run");
      expect(action.payload).toBeFalsy();

      const { isRunning } = clockSlice.reducer(initialState, action);
      expect(isRunning).toEqual(true);
    });
  });

  describe("halt", () => {
    it("should stop the clock", () => {
      const action = halt();
      expect(action.type).toEqual("clock/halt");
      expect(action.payload).toBeFalsy();

      const { isRunning } = clockSlice.reducer(initialState, action);
      expect(isRunning).toEqual(false);
    });
  });
});
