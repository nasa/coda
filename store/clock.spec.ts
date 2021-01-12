import FakeTimers from "@sinonjs/fake-timers";
import {
  clockSlice,
  ClockState,
  getApplicationUTC,
  getMissionTime,
  initialState,
  set,
  start,
  stop,
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
  describe("set", () => {
    it("should set the current application time", () => {
      const utc = new Date().toISOString();
      const { type, payload } = set(utc);
      expect(type).toEqual("clock/set");
      expect(payload).toEqual(utc);
    });
  });

  describe("start", () => {
    it("should start the clock within a few ms of dispatch", () => {
      const action = start();
      expect(action.type).toEqual("clock/start");
      expect(action.payload).toBeFalsy();

      const { isRunning, lastStarted, lastStopped } = clockSlice.reducer(initialState, action);
      expect(new Date(lastStarted)).toHappenAround(new Date());
      expect(isRunning).toEqual(true);
      expect(lastStopped).toBeNull();
    });
  });

  describe("stop", () => {
    it("should stop the clock within a few ms of dispatch", () => {
      const action = stop();
      expect(action.type).toEqual("clock/stop");
      expect(action.payload).toBeFalsy();

      const { lastStopped } = clockSlice.reducer(initialState, action);
      expect(new Date(lastStopped)).toHappenAround(new Date());
    });
  });

  describe("application time helpers", () => {
    it("#getApplicationUTC should return the UTC of the application set time when the mission has not started", () => {
      const d = new Date();
      const s = {
        isRunning: false,
        ready: true,
        applicationTime: d.toISOString(),
        lastStarted: null,
        lastStopped: null,
      } as ClockState;

      const received = getApplicationUTC(s);
      expect(received).toHappenAround(d);
    });

    it("#getApplicationUTC should return a diff between now and the set time when a mission is running", () => {
      const clock = FakeTimers.install({ toFake: ["Date"] });

      const applicationTime = new Date(1985, 11, 5, 0, 1, 0, 0);
      const lastStarted = new Date();
      const s = {
        isRunning: true,
        ready: true,
        applicationTime: applicationTime.toISOString(),
        lastStarted: lastStarted.toISOString(),
        lastStopped: null,
      } as ClockState;

      // five seconds later
      const expectedTime = new Date(1985, 11, 5, 0, 1, 5, 0);
      clock.tick(5000);

      const received = getApplicationUTC(s);
      expect(received).toHappenAround(expectedTime);

      clock.uninstall();
    });

    it("#getApplicationUTC should return a diff between when a mission was started and stopped when it isn't running", () => {
      const applicationTime = new Date(1985, 11, 5, 0, 1, 0);
      const lastStarted = new Date(2021, 1, 8, 0, 0, 0);
      // five seconds later
      const lastStopped = new Date(2021, 1, 8, 0, 0, 5);
      const s = {
        isRunning: false,
        ready: true,
        applicationTime: applicationTime.toISOString(),
        lastStarted: lastStarted.toISOString(),
        lastStopped: lastStopped.toISOString(),
      } as ClockState;

      // five seconds later
      const expectedTime = new Date(1985, 11, 5, 0, 1, 5);

      const received = getApplicationUTC(s);
      expect(received).toHappenAround(expectedTime);
    });

    it("#getApplicationUTC should return a diff between now and when a mission was started when it is running", () => {
      const clock = FakeTimers.install({ toFake: ["Date"] });

      const applicationTime = new Date(1985, 11, 5, 0, 1, 0);
      const lastStopped = new Date(2021, 1, 7, 23, 23, 59);
      const lastStarted = new Date();

      const s = {
        isRunning: true,
        ready: true,
        applicationTime: applicationTime.toISOString(),
        lastStopped: lastStopped.toISOString(),
        lastStarted: lastStarted.toISOString(),
      } as ClockState;

      // five seconds later
      const expectedTime = new Date(1985, 11, 5, 0, 1, 5);
      clock.tick(5000);

      const received = getApplicationUTC(s);
      expect(received).toHappenAround(expectedTime);

      clock.uninstall();
    });

    it("#getApplicationUTC should return a diff between now and when a mission was started when it is running, realtime", async () => {
      const applicationTime = new Date(Date.UTC(1985, 11, 5, 0, 1, 0));
      const lastStarted = new Date();

      const s = {
        isRunning: true,
        ready: true,
        applicationTime: applicationTime.toISOString(),
        lastStopped: null,
        lastStarted: lastStarted.toISOString(),
      } as ClockState;

      // five seconds later
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });

      const expectedTime = new Date(Date.UTC(1985, 11, 5, 0, 1, 2));

      const received = getApplicationUTC(s);
      expect(received).toHappenAround(expectedTime);
    });

    it("#getApplicationUTC should return null when the clock hasn't been set", () => {
      const s = {
        isRunning: true,
        ready: true,
        applicationTime: null,
        lastStopped: null,
        lastStarted: null,
      } as ClockState;

      const received = getApplicationUTC(s);
      expect(received).toBeNull();
    });

    it("#getMissionTime should return 0 when the clock has not been set", () => {
      const s = {
        isRunning: true,
        ready: true,
        applicationTime: null,
        lastStopped: null,
        lastStarted: null,
      } as ClockState;

      const received = getMissionTime(s);
      expect(received).toEqual(0);
    });

    it("#getMissionTime should return the number of UTC seconds past midnight when the clock is running", () => {
      const clock = FakeTimers.install({ toFake: ["Date"] });

      // note we're at midnight UTC
      const applicationTime = new Date(Date.UTC(1985, 11, 5, 0, 0, 0, 0));
      const lastStarted = new Date();
      const s = {
        isRunning: true,
        ready: true,
        applicationTime: applicationTime.toISOString(),
        lastStarted: lastStarted.toISOString(),
        lastStopped: null,
      } as ClockState;

      clock.tick(5000);

      // should be 5 seconds past midnight
      const received = getMissionTime(s);
      expect(received).toEqual(5);

      clock.uninstall();
    });
  });

  describe("stops and starts", () => {
    it("picks up where it left off when you start, stop, start", () => {
      const clock = FakeTimers.install({ toFake: ["Date"] });

      const firstStart = new Date();
      const set1 = set(firstStart.toISOString());
      let s = clockSlice.reducer(initialState, set1);

      const start1 = start();
      s = clockSlice.reducer(s, start1);

      clock.tick(5000);

      const afterFirstStart = getMissionTime(s);
      expect(afterFirstStart).toEqual(5);

      const stop1 = stop();
      s = clockSlice.reducer(s, stop1);

      // let some time pass after the clock is stopped
      clock.tick(5000);

      // we should get the same time if the clock is stopped
      const afterStop = getMissionTime(s);
      expect(afterStop).toEqual(5);

      // start the clock again and let time elapse
      const start2 = start();
      s = clockSlice.reducer(s, start2);

      clock.tick(5000);

      const afterSecondStart = getMissionTime(s);
      expect(afterSecondStart).toEqual(10);

      clock.uninstall();
    });

    it("lets you hit start multiple times", () => {
      const clock = FakeTimers.install({ toFake: ["Date"] });

      const firstStart = new Date();
      const set1 = set(firstStart.toISOString());
      let s = clockSlice.reducer(initialState, set1);

      const start1 = start();
      s = clockSlice.reducer(s, start1);

      clock.tick(5000);

      const afterFirstStart = getMissionTime(s);
      expect(afterFirstStart).toEqual(5);

      // hit start again, which should not impact the clock
      const start2 = start();
      s = clockSlice.reducer(s, start2);

      clock.tick(5000);

      const afterSecondStart = getMissionTime(s);
      expect(afterSecondStart).toEqual(10);

      clock.uninstall();
    });

    it("lets you hit stop multiple times", () => {
      const clock = FakeTimers.install({ toFake: ["Date"] });

      const firstStart = new Date();
      const set1 = set(firstStart.toISOString());
      let s = clockSlice.reducer(initialState, set1);

      const start1 = start();
      s = clockSlice.reducer(s, start1);

      clock.tick(5000);

      const afterFirstStart = getMissionTime(s);
      expect(afterFirstStart).toEqual(5);

      const stop1 = stop();
      s = clockSlice.reducer(s, stop1);

      clock.tick(5000);

      const afterFirstStop = getMissionTime(s);
      expect(afterFirstStop).toEqual(5);

      // hit stop again, which should not impact the clock
      const stop2 = stop();
      s = clockSlice.reducer(s, stop2);

      clock.tick(5000);

      const afterSecondStop = getMissionTime(s);
      expect(afterSecondStop).toEqual(5);

      clock.uninstall();
    });
  });
});
