import { parseWikitextTableIntoDatetimeOverrides } from "server/services/wiki-api";

describe("prase date time shifts from wiki", () => {
  it("should convert wiki tables to objects", async () => {
    const wikiRaw =
      'This page is accessed by the CODA application to manually set video start times in UTC. If you need to find the video start time from a QR code [https://coda.fit.nasa.gov/clocksync/index.html], see this Python script (https://github.com/bfeist/VideoQRAnalyser) from [[Ben Feist]]. If you need to use that time to set other videos from the same camera, see clockcalc [https://coda.fit.nasa.gov/clockcalc/clockcalc.html].\n\nThe "videoID" in this table is the "NASA ID" of a video in Imagery Online. The "time" is the actual UTC start time of the video.\n{| class="wikitable"\n|-\n!videoID!!time\n|-\n|jsc2021m000836||2021-05-14T00:26:57Z\n|-\n|jsc2021m000833||2021-05-14T00:47:08Z\n|-\n|jsc2021m000832||2021-05-14T00:46:51Z\n|}\n\n\nWe also need to identify the time offset that the still cameras were set to for some test events. These offsets can be a result of:\n\n* The camera being set to a local timezone instead of UTC.\n* The clock itself being set incorrectly, or having drifted over a long period of time without being reset\n* Both (Test Event 50 is an example of "both")\n\nThe "testEventID" is the test event ID in this wiki. The "timeoffset" is the (incorrect) set time of the cameras in hh:mm:ss from UTC.\n\n{| class="wikitable"\n|-\n!testEventID!!timeoffset\n|-\n|126||UTC-05:00:00\n|-\n|50||UTC-05:01:12\n|}';
    const output = {
      videoFixes: [
        { videoID: "jsc2021m000836", time: "2021-05-14T00:26:57Z" },
        { videoID: "jsc2021m000833", time: "2021-05-14T00:47:08Z" },
        { videoID: "jsc2021m000832", time: "2021-05-14T00:46:51Z" },
      ],
      testEventTimezones: [
        { testEventID: "126", timeoffset: "UTC-05:00:00" },
        { testEventID: "50", timeoffset: "UTC-05:01:12" },
      ],
    };
    expect(parseWikitextTableIntoDatetimeOverrides(wikiRaw)).toEqual(output);
  });
});
