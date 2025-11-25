import { getNextPosition, updateOrbitLine } from "./map";
import { getAppropriateTLE } from "store/ephemera";
import { getLatLngObj } from "tle.js";

// Mock dependencies
jest.mock("store/ephemera");
jest.mock("tle.js");

const mockGetAppropriateTLE = getAppropriateTLE as jest.MockedFunction<typeof getAppropriateTLE>;
const mockGetLatLngObj = getLatLngObj as jest.MockedFunction<typeof getLatLngObj>;

describe("getNextPosition", () => {
  const mockEphemeraItems: EphemerisEntry[] = [
    {
      tle_line1: "1 25544U 98067A   23001.00000000  .00016717  00000-0  10270-3 0  9005",
      tle_line2: "2 25544  51.6442 339.8014 0001976  94.8340 265.2864 15.54225995123456",
      epoch: "2023-01-01T00:00:00.000000",
    },
  ];

  const mockTLE = `ISS (ZARYA)
1 25544U 98067A   23001.00000000  .00016717  00000-0  10270-3 0  9005
2 25544  51.6442 339.8014 0001976  94.8340 265.2864 15.54225995123456`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should calculate position for a given datetime and increment", () => {
    const dateTime = "2023-01-01T12:00:00";
    const increment = 60; // 60 seconds
    const expectedPosition = { lat: 45.5, lng: -122.6 };

    mockGetAppropriateTLE.mockReturnValue(mockTLE);
    mockGetLatLngObj.mockReturnValue(expectedPosition);

    const result = getNextPosition(dateTime, increment, mockEphemeraItems);

    expect(mockGetAppropriateTLE).toHaveBeenCalledWith(mockEphemeraItems, dateTime);
    expect(mockGetLatLngObj).toHaveBeenCalledWith(
      mockTLE,
      new Date(dateTime).getTime() + increment * 1000
    );
    expect(result).toEqual(expectedPosition);
  });

  test("should handle zero increment", () => {
    const dateTime = "2023-01-01T12:00:00";
    const increment = 0;
    const expectedPosition = { lat: 0, lng: 0 };

    mockGetAppropriateTLE.mockReturnValue(mockTLE);
    mockGetLatLngObj.mockReturnValue(expectedPosition);

    const result = getNextPosition(dateTime, increment, mockEphemeraItems);

    expect(mockGetLatLngObj).toHaveBeenCalledWith(mockTLE, new Date(dateTime).getTime());
    expect(result).toEqual(expectedPosition);
  });

  test("should handle negative increment (past position)", () => {
    const dateTime = "2023-01-01T12:00:00";
    const increment = -300; // 5 minutes in the past
    const expectedPosition = { lat: 40.2, lng: -75.3 };

    mockGetAppropriateTLE.mockReturnValue(mockTLE);
    mockGetLatLngObj.mockReturnValue(expectedPosition);

    const result = getNextPosition(dateTime, increment, mockEphemeraItems);

    expect(mockGetLatLngObj).toHaveBeenCalledWith(
      mockTLE,
      new Date(dateTime).getTime() + increment * 1000
    );
    expect(result).toEqual(expectedPosition);
  });

  test("should handle large increment", () => {
    const dateTime = "2023-01-01T12:00:00";
    const increment = 3600; // 1 hour
    const expectedPosition = { lat: -30.5, lng: 150.2 };

    mockGetAppropriateTLE.mockReturnValue(mockTLE);
    mockGetLatLngObj.mockReturnValue(expectedPosition);

    const result = getNextPosition(dateTime, increment, mockEphemeraItems);

    expect(result).toEqual(expectedPosition);
  });
});

describe("updateOrbitLine", () => {
  const mockEphemeraItems: EphemerisEntry[] = [
    {
      tle_line1: "1 25544U 98067A   23001.00000000  .00016717  00000-0  10270-3 0  9005",
      tle_line2: "2 25544  51.6442 339.8014 0001976  94.8340 265.2864 15.54225995123456",
      epoch: "2023-01-01T00:00:00.000000",
    },
  ];

  const mockTLE = `ISS (ZARYA)
1 25544U 98067A   23001.00000000  .00016717  00000-0  10270-3 0  9005
2 25544  51.6442 339.8014 0001976  94.8340 265.2864 15.54225995123456`;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppropriateTLE.mockReturnValue(mockTLE);
  });

  test("should generate orbit line coordinates without crossing date line", () => {
    const dateTime = "2023-01-01";
    const timeStr = "12:00:00";

    // Mock positions that don't cross the date line
    let callCount = 0;
    mockGetLatLngObj.mockImplementation(() => {
      const positions = [
        { lat: 45, lng: -120 },
        { lat: 46, lng: -119 },
        { lat: 47, lng: -118 },
        { lat: 48, lng: -117 },
      ];
      return positions[callCount++ % positions.length];
    });

    const result = updateOrbitLine(dateTime, timeStr, mockEphemeraItems);

    expect(result.coordinates1.length).toBeGreaterThan(0);
    expect(result.coordinates2.length).toBe(0); // No date line crossing
    expect(result.coordinates1[0]).toHaveLength(2); // [lng, lat] format
  });

  test("should split orbit line when crossing the date line", () => {
    const dateTime = "2023-01-01";
    const timeStr = "12:00:00";

    // Mock positions that cross the date line
    let callCount = 0;
    mockGetLatLngObj.mockImplementation(() => {
      const positions = [
        { lat: 45, lng: 170 },
        { lat: 46, lng: 175 },
        { lat: 47, lng: 179 },
        { lat: 48, lng: -179 }, // Date line crossing here
        { lat: 49, lng: -175 },
        { lat: 50, lng: -170 },
      ];
      const idx = callCount++;
      if (idx < positions.length) {
        return positions[idx];
      }
      return positions[positions.length - 1];
    });

    const result = updateOrbitLine(dateTime, timeStr, mockEphemeraItems);

    expect(result.coordinates1.length).toBeGreaterThan(0);
    expect(result.coordinates2.length).toBeGreaterThan(0); // Date line crossing detected
  });

  test("should format coordinates as [lng, lat] pairs", () => {
    const dateTime = "2023-01-01";
    const timeStr = "12:00:00";

    mockGetLatLngObj.mockReturnValue({ lat: 45.5, lng: -122.6 });

    const result = updateOrbitLine(dateTime, timeStr, mockEphemeraItems);

    expect(result.coordinates1[0]).toEqual([-122.6, 45.5]);
  });

  test("should use correct time range and step size", () => {
    const dateTime = "2023-01-01";
    const timeStr = "12:00:00";

    mockGetLatLngObj.mockReturnValue({ lat: 0, lng: 0 });

    updateOrbitLine(dateTime, timeStr, mockEphemeraItems);

    // Range: -2000 to 3800 seconds with 10-second steps
    // Expected calls: (3800 - (-2000)) / 10 = 580 calls
    const expectedCalls = Math.floor((3800 - -2000) / 10);

    expect(mockGetLatLngObj).toHaveBeenCalledTimes(expectedCalls);
  });

  test("should combine date and time strings correctly", () => {
    const dateTime = "2023-01-15";
    const timeStr = "14:30:45";

    mockGetLatLngObj.mockReturnValue({ lat: 0, lng: 0 });

    updateOrbitLine(dateTime, timeStr, mockEphemeraItems);

    // Check that getAppropriateTLE was called with the combined datetime
    const firstCall = mockGetAppropriateTLE.mock.calls[0];
    expect(firstCall[1]).toBe(`${dateTime}T${timeStr}Z`);
  });

  test("should detect date line crossing with large longitude step", () => {
    const dateTime = "2023-01-01";
    const timeStr = "12:00:00";

    // Create a scenario where the longitude difference jumps > 100 degrees
    let callCount = 0;
    mockGetLatLngObj.mockImplementation(() => {
      const lng = callCount === 0 ? 170 : callCount === 1 ? 171 : -179;
      callCount++;
      return { lat: 45, lng };
    });

    const result = updateOrbitLine(dateTime, timeStr, mockEphemeraItems);

    // Should detect the large step and split into two coordinate arrays
    expect(result.coordinates1.length).toBeGreaterThan(0);
    expect(result.coordinates2.length).toBeGreaterThan(0);
  });

  test("should handle edge case with minimal coordinates", () => {
    const dateTime = "2023-01-01";
    const timeStr = "12:00:00";

    mockGetLatLngObj.mockReturnValue({ lat: 0, lng: 0 });

    const result = updateOrbitLine(dateTime, timeStr, mockEphemeraItems);

    expect(result).toHaveProperty("coordinates1");
    expect(result).toHaveProperty("coordinates2");
    expect(Array.isArray(result.coordinates1)).toBe(true);
    expect(Array.isArray(result.coordinates2)).toBe(true);
  });
});
