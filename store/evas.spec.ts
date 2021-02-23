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

      const action = addEVAs({ us_eva_100: newEVA });
      expect(action.type).toEqual("evas/addEVAs");
      expect(action.payload["us_eva_100"]).toEqual(newEVA);

      const { EVAs } = evasSlice.reducer(initialState, action);
      expect(Object.keys(EVAs).length).toEqual(1);
      expect(EVAs["us_eva_100"]).toEqual(newEVA);
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

      const action = addEVAs({ us_eva_100: newEVA1, us_eva_101: newEVA2 });

      const { EVAs } = evasSlice.reducer(initialState, action);
      expect(Object.keys(EVAs).length).toEqual(2);
      expect(EVAs["us_eva_100"]).toEqual(newEVA1);
      expect(EVAs["us_eva_101"]).toEqual(newEVA2);
    });

    it("should overwrite an existing EVA", () => {
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
      const oldState = { ...initialState, EVAs: { us_eva_100: oldEVA } };

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

      const action = addEVAs({ us_eva_100: updatedEVA });

      const { EVAs } = evasSlice.reducer(oldState, action);
      expect(Object.keys(EVAs).length).toEqual(1);
      expect(EVAs["us_eva_100"]).toEqual(updatedEVA);
    });
  });
});
