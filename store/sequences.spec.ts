import {
  idFromSequence,
  idFromDate,
  getSequenceStartMilliseconds,
  getAsPerformedMissionTime,
} from "store/sequences";
import { SequenceType } from "utils/enums";

describe("store/sequences", () => {
  const seq: Sequence = {
    location: "testLoc",
    type: SequenceType.testing,
    name: "testName",
    displayTitle: "",
    dataURL: "",
    startTime: "21:39",
    startDate: "2022-07-27",
    endDate: "",
    duration: null,
    crew: null,
    asPerformed: null,
    asPlanned: null,
  };
  it("idFromSequence() - converts sequence to id string", () => {
    expect(idFromSequence(seq)).toEqual("2022-07-27-testLoc-3-testName");
  });

  it("idFromDate() - converts UTC string date to yyyy-mm-dd string", () => {
    expect(idFromDate("2022-07-27T21:39:19Z")).toEqual("2022-07-27");
  });

  it("getSequenceStartMiliseconds() - returns ms since 1/1/1970 for sequence start date/time", () => {
    expect(getSequenceStartMilliseconds(seq)).toEqual(new Date("2022-07-27T21:39Z").getTime());
  });

  it("getAsPerformedMissionTime() - sets start and end time (seconds) for activities", () => {
    const activities: Activity[] = [
      { content: "A", color: "", duration: 10 },
      { content: "B", color: "", duration: 15 },
      { content: "C", color: "", duration: 10 },
    ];
    const activitiesWithStart: Activity[] = [
      { content: "A", color: "", duration: 10, startTimeSeconds: 1, endTimeSeconds: 11 },
      { content: "B", color: "", duration: 15, startTimeSeconds: 11, endTimeSeconds: 26 },
      { content: "C", color: "", duration: 10, startTimeSeconds: 26, endTimeSeconds: 36 },
    ];
    expect(getAsPerformedMissionTime(activities, "1970-01-01", 1000)).toEqual(activitiesWithStart);
  });
});
