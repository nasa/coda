import { getChannel } from "services/io-api";

describe("getChannel()", () => {
  it("should return a channel string when one is available", () => {
    const collectionString = [
      "P0/ISS Missions",
      "P4/ISS Missions|ISS-060",
      "P2328011/ISS Missions|ISS-060|Video",
      "P2342255/ISS Missions|ISS-060|Video|US Downlink",
      "P2344036/ISS Missions|ISS-060|Video|US Downlink|Channel 03",
      "P2344047/ISS Missions|ISS-060|Video|US Downlink|Channel 03|SD",
      "P2344048/ISS Missions|ISS-060|Video|US Downlink|Channel 03|SD|2019-08-19 to 08-23 (GMT 231 to 235)",
    ];

    expect(getChannel(collectionString)).toEqual("03");
  });

  it("should return an empty string when a channel is not available", () => {
    const collectionString = [
      "P0/ISS Missions",
      "P4/ISS Missions|ISS-060",
      "P2328011/ISS Missions|ISS-060|Video",
      "P2342255/ISS Missions|ISS-060|Video|US Downlink",
    ];

    expect(getChannel(collectionString)).toEqual("");
  });
});
