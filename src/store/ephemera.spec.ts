import { getAppropriateTLE } from "./ephemera";

describe("getAppropriateTLE", () => {
  const ephemerisFiles = [
    {
      EPOCH: "2023-04-27 23:53:15",
      TLE_LINE0: "0 ISS (ZARYA)",
      TLE_LINE1: "1 25544U 98067A   23117.99531396  .00019654  00000-0  34685-3 0  9993",
      TLE_LINE2: "2 25544  51.6402 217.2782 0005322 249.3970 274.7771 15.50368762394009",
    },
    {
      EPOCH: "2023-04-27 17:24:06",
      TLE_LINE0: "0 ISS (ZARYA)",
      TLE_LINE1: "1 25544U 98067A   23117.72507036  .00019323  00000-0  34129-3 0  9994",
      TLE_LINE2: "2 25544  51.6396 218.6162 0005309 248.6829 206.1814 15.50357183393964",
    },
    {
      EPOCH: "2023-04-27 12:51:43",
      TLE_LINE0: "0 ISS (ZARYA)",
      TLE_LINE1: "1 25544U 98067A   23117.53591650  .00019446  00000-0  34350-3 0  9990",
      TLE_LINE2: "2 25544  51.6406 219.5567 0005317 247.5469 230.8975 15.50349702393939",
    },
    {
      EPOCH: "2023-04-27 07:05:57",
      TLE_LINE0: "0 ISS (ZARYA)",
      TLE_LINE1: "1 25544U 98067A   23117.29580829  .00021162  00000-0  37309-3 0  9994",
      TLE_LINE2: "2 25544  51.6386 220.7438 0005539 246.6442 330.8231 15.50344675393899",
    },
  ];

  test("returns the appropriate TLE string closest to the dateTimeWanted", () => {
    const dateTimeWanted = "2023-04-27T14:00:00Z";
    const expectedTLE = `0 ISS (ZARYA)
                  1 25544U 98067A   23117.53591650  .00019446  00000-0  34350-3 0  9990
                  2 25544  51.6406 219.5567 0005317 247.5469 230.8975 15.50349702393939`;

    const result = getAppropriateTLE(ephemerisFiles, dateTimeWanted);

    expect(result).toBe(expectedTLE);
  });
});
