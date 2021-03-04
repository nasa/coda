import { update } from "lodash";
import { EVA } from "services/iss-wiki";
import { initialState, evasSlice, addEVAs } from "store/evas";

describe("store/evasSlice", () => {
  describe("#addEVAs", () => {
    it("should add one EVA to the store", () => {
      const newEVA: EVA = {
        name: "us_eva_100",
        wikiURL: "",
        displayTitle: "US EVA 100 TEST",
        startDate: new Date().toISOString(),
        startTime: "00:00",
        duration: 0,
        activityPerformance: { EV1: [], EV2: [] },
        dayNight: { events: [], dataStartUTC: 0 },
      };

      const payload = {};
      // the date doesn't really matter
      // there is no check that the date index matches the EVA start date
      const date = "2020-12-31";
      payload[date] = newEVA;
      const action = addEVAs(payload);
      expect(action.type).toEqual("evas/addEVAs");
      expect(action.payload[date]).toEqual(newEVA);

      const { objects } = evasSlice.reducer(initialState, action);
      expect(Object.keys(objects).length).toEqual(1);
      expect(objects[date]).toEqual(newEVA);
    });

    it("should add multiple EVAs to the store", () => {
      const newEVA1: EVA = {
        name: "us_eva_100",
        wikiURL: "",
        displayTitle: "US EVA 100 TEST",
        startDate: new Date().toISOString(),
        startTime: "00:00",
        duration: 0,
        activityPerformance: { EV1: [], EV2: [] },
        dayNight: { events: [], dataStartUTC: 0 },
      };
      const newEVA2: EVA = {
        name: "us_eva_101",
        wikiURL: "",
        displayTitle: "US EVA 100 TEST",
        startDate: new Date().toISOString(),
        startTime: "00:00",
        duration: 0,
        activityPerformance: { EV1: [], EV2: [] },
        dayNight: { events: [], dataStartUTC: 0 },
      };

      const payload = {};
      const date1 = "2020-12-30";
      const date2 = "2020-12-31";
      payload[date1] = newEVA1;
      payload[date2] = newEVA2;

      const action = addEVAs(payload);

      const { objects } = evasSlice.reducer(initialState, action);
      expect(Object.keys(objects).length).toEqual(2);
      expect(objects[date1]).toEqual(newEVA1);
      expect(objects[date2]).toEqual(newEVA2);
    });

    it("should overwrite an existing EVA", () => {
      const date = "2020-12-30";
      const oldEVA: EVA = {
        name: "us_eva_100",
        wikiURL: "",
        displayTitle: "US EVA 100 TEST",
        startDate: new Date().toISOString(),
        startTime: "00:00",
        duration: 0,
        activityPerformance: { EV1: [], EV2: [] },
        dayNight: { events: [], dataStartUTC: 0 },
      };
      const objects = {};
      objects[date] = oldEVA;
      const oldState = { ...initialState, objects };

      const updatedDisplayTitle = "US EVA 100 TEST FIXED";
      const updatedEVA: EVA = {
        name: "us_eva_100",
        wikiURL: "http://fixedURL",
        displayTitle: updatedDisplayTitle,
        startDate: new Date().toISOString(),
        startTime: "00:01",
        duration: 1,
        activityPerformance: { EV1: [], EV2: [] },
        dayNight: { events: [], dataStartUTC: 0 },
      };

      const payload = {};
      payload[date] = updatedEVA;
      const action = addEVAs(payload);

      const { objects: updatedObjects } = evasSlice.reducer(oldState, action);
      expect(Object.keys(updatedObjects).length).toEqual(1);
      expect(updatedObjects[date]).toEqual(updatedEVA);
    });

    it("should mark when the store was updated", () => {
      const newEVA: EVA = {
        name: "us_eva_100",
        wikiURL: "",
        displayTitle: "US EVA 100 TEST",
        startDate: new Date().toISOString(),
        startTime: "00:00",
        duration: 0,
        activityPerformance: { EV1: [], EV2: [] },
        dayNight: { events: [], dataStartUTC: 0 },
      };

      const action = addEVAs({ us_eva_100: newEVA });

      const { lastChecked } = evasSlice.reducer(initialState, action);
      expect(new Date(lastChecked)).toHappenAround(new Date());
    });

    it("should clear out any error messages", () => {
      const newEVA: EVA = {
        name: "us_eva_100",
        wikiURL: "",
        displayTitle: "US EVA 100 TEST",
        startDate: new Date().toISOString(),
        startTime: "00:00",
        duration: 0,
        activityPerformance: { EV1: [], EV2: [] },
        dayNight: { events: [], dataStartUTC: 0 },
      };

      const oldState = { ...initialState, errorMessage: "wiki imploded :(" };

      const payload = {};
      const date = "2020-12-31";
      payload[date] = newEVA;
      const action = addEVAs(payload);

      const { errorMessage } = evasSlice.reducer(oldState, action);
      expect(errorMessage).toEqual("");
    });
  });
});
