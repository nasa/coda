import { createSelector, createSlice } from "@reduxjs/toolkit";
import { create } from "domain";
import { Activity, EVA, ParsedEVADetails } from "services/iss-wiki";
import { TimingData } from "store/videos";

export interface EVAsState {
  /** Keyed in the format of underscored lowercase EVA name, eg. `us_eva_55` */
  EVAs: { [key: string]: EVA };
  /** Format of underscored lowercase EVA name, eg. `us_eva_55` */
  selectedEVA: string;
  /** Message describing something that went wrong fetching EVAs */
  errorMessage: string;
}

export const initialState: EVAsState = {
  EVAs: {},
  selectedEVA: "",
  errorMessage: "",
};

export const evasSlice = createSlice({
  name: "evas",
  initialState,
  reducers: {},
});

export const evaSelector = (state: EVAsState) => state.EVAs[state.selectedEVA];

export const selectEVAStartMilliseconds = createSelector(evaSelector, (eva) => {
  const { startDate, startTime } = eva;
  const [Y, M, D] = startDate.split("/").map(Number);
  const [hh, mm] = startTime.split(/:/).map(Number);
  return Date.UTC(Y, M - 1, D, hh, mm);
});

export const makeActivityPerformanceSelector = (
  timingData,
  dayNight,
  activityStartUTCMilliseconds
) => {
  return createSelector(evaSelector, ({ activityPerformance }) => {
    const res = {
      EV1: [],
      EV2: [],
    } as { [key: string]: Activity[] };

    // get activity times in the mission timeframe
    let thisStartTimeSeconds =
      (activityStartUTCMilliseconds - timingData.video_earliestStart.getTime()) / 1000;

    for (let a = 0; a < activityPerformance.EV1.length; a++) {
      const {
        color,
        content,
        duration,
        startTimeSeconds,
        endTimeSeconds,
      } = activityPerformance.EV1[a];
      const activity = {
        color,
        content,
        duration,
        startTimeSeconds,
        endTimeSeconds,
      } as Activity;
      activity.startTimeSeconds = thisStartTimeSeconds;
      activity.endTimeSeconds = thisStartTimeSeconds + duration;
      thisStartTimeSeconds = thisStartTimeSeconds + duration;

      res.EV1.push(activity);
    }
    thisStartTimeSeconds =
      (activityStartUTCMilliseconds - timingData.video_earliestStart.getTime()) / 1000;

    for (let a = 0; a < activityPerformance.EV2.length; a++) {
      const {
        color,
        content,
        duration,
        startTimeSeconds,
        endTimeSeconds,
      } = activityPerformance.EV2[a];
      const activity = {
        color,
        content,
        duration,
        startTimeSeconds,
        endTimeSeconds,
      } as Activity;

      activity.startTimeSeconds = thisStartTimeSeconds;
      activity.endTimeSeconds = thisStartTimeSeconds + duration;
      thisStartTimeSeconds = thisStartTimeSeconds + duration;

      res.EV2.push(activity);
    }

    // slightly different for dayNight object
    // thisStartTimeSeconds =
    //   (dayNight.dataStartUTC - timingData.video_earliestStart.getTime()) / 1000;
    // for (let e = 0; e < dayNight.events.length; e++) {
    //   const event = dayNight.events[e];
    //   event.startTimeSeconds = thisStartTimeSeconds;
    //   event.endTimeSeconds = thisStartTimeSeconds + event.duration * 60;
    //   thisStartTimeSeconds = thisStartTimeSeconds + event.duration * 60;
    // }

    return res;
  });
};
