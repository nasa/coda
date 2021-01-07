import configureMockStore, { MockStore } from "redux-mock-store";
import FakeTimers from "@sinonjs/fake-timers";
import {
  clockSlice,
  ClockState,
  getApplicationTime,
  initialState,
  set,
  start,
} from "store/clock";

// adds handy matchers for comparing clock times
expect.extend({
  toHappenAround(x: Date, y: Date, z: string) {
    const received = x.getTime();
    const expected = y.getTime();
    return {
      pass: Math.abs(received / 1000 - expected / 1000) < 1,
      message: () =>
        `Received time ${x} is not within 1 second of ${y}${z ? ` ${z}` : ""}`,
    };
  },
});

describe("store/clockSlice", () => {
  const mockStore = configureMockStore();
  let store: MockStore;

  describe("set", () => {
    beforeEach(() => {
      store = mockStore(initialState);
    });

    it("should set the current application time", () => {
      const utc = new Date().toISOString();
      const { type, payload } = set(utc);
      expect(type).toEqual("clock/set");
      expect(payload).toEqual(utc);
    });
  });

  describe("start", () => {
    beforeEach(() => {
      store = mockStore(initialState);
    });

    it("should start the clock within a few ms of dispatch", () => {
      const action = start();
      expect(action.type).toEqual("clock/start");
      expect(action.payload).toBeFalsy();

      const { isRunning, lastStarted, lastStopped } = clockSlice.reducer(
        initialState,
        action
      );
      expect(new Date(lastStarted)).toHappenAround(new Date());
      expect(isRunning).toEqual(true);
      expect(lastStopped).toBeNull();
    });
  });

  describe("application time helpers", () => {
    beforeEach(() => {
      store = mockStore(initialState);
    });

    it("#getApplicationTime should return a moment representing the application set time when the mission has not started", () => {
      const d = new Date();
      const s = {
        isRunning: false,
        ready: true,
        applicationTime: d.toISOString(),
        lastStarted: null,
        lastStopped: null,
      } as ClockState;

      const received = getApplicationTime(s);
      expect(received.toISOString()).toEqual(d.toISOString());
    });

    it("#getApplicationTime should return a diff between now and the set time when a mission is running", () => {
      const clock = FakeTimers.install({ toFake: ["Date"] });

      const applicationTime = new Date(1985, 11, 5, 0, 1, 0);
      const lastStarted = new Date();
      const s = {
        isRunning: true,
        ready: true,
        applicationTime: applicationTime.toISOString(),
        lastStarted: lastStarted.toISOString(),
        lastStopped: null,
      } as ClockState;

      // five seconds later
      const expectedTime = new Date(1985, 11, 5, 0, 1, 5);
      clock.tick(5000);

      const received = getApplicationTime(s);
      expect(received.toDate()).toHappenAround(expectedTime);

      clock.uninstall();
    });
  });
});
