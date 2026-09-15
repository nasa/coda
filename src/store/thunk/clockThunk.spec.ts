import { store } from "store";
import { resetClock, setDate, setAppSeconds, startClock } from "store/clock";
import { addPhotos, initialPhotoFileState } from "store/photos";
import { thunkChangeViewingDate } from "./clockThunk";

describe("thunkChangeViewingDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T15:00:00Z"));
    store.dispatch(resetClock());
    store.dispatch(setDate("2026-06-30T00:00:00.000Z"));
    store.dispatch(setAppSeconds(43200));
    store.dispatch(
      addPhotos({
        data: [{ ...initialPhotoFileState, id: "eva-photo" }],
        fetchMetadata: { success: true, timestamp: new Date().toISOString() },
      })
    );
  });

  afterEach(() => vi.useRealTimers());

  it.each(["2026-06-30T00:00:00.000Z", "2026-06-30"])(
    "preserves loaded data and the running playhead on a same-day selection: %s",
    async (newDate) => {
      store.dispatch(startClock());
      vi.advanceTimersByTime(5000);
      const before = store.getState();

      await store.dispatch(thunkChangeViewingDate({ newDate, keepCurrentTime: true })).unwrap();

      const after = store.getState();
      expect(after.photos).toBe(before.photos);
      expect(after.clock.date).toBe(before.clock.date);
      expect(after.clock.appSecondsAtStartStop).toBe(43205);
      expect(after.clock.isRunning).toBe(true);
    }
  );

  it("allows seeking within the current day without clearing data", async () => {
    const photos = store.getState().photos;
    await store
      .dispatch(thunkChangeViewingDate({ newDate: "2026-06-30", newAppSeconds: 3600 }))
      .unwrap();
    expect(store.getState().photos).toBe(photos);
    expect(store.getState().clock.appSecondsAtStartStop).toBe(3600);
  });

  it("clears loaded data and changes the date when selecting another day", async () => {
    await store
      .dispatch(thunkChangeViewingDate({ newDate: "2026-06-29", keepCurrentTime: true }))
      .unwrap();
    expect(store.getState().photos.photoFiles).toEqual([]);
    expect(store.getState().photos.ready).toBe(false);
    expect(store.getState().clock.date).toBe("2026-06-29");
    expect(store.getState().clock.appSecondsAtStartStop).toBe(43200);
  });

  it("preserves today's data when the clock uses its default date", async () => {
    store.dispatch(setDate(null));
    const photos = store.getState().photos;
    await store
      .dispatch(thunkChangeViewingDate({ newDate: "2026-07-01", keepCurrentTime: true }))
      .unwrap();
    expect(store.getState().photos).toBe(photos);
  });
});
