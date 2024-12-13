import SunCalc from "./suncalc";

describe("SunCalc", () => {
  test("getPosition returns azimuth and altitude", () => {
    const date = new Date("2023-07-20T12:00:00Z");
    const lat = 40.7128;
    const lng = -74.006;
    const position = SunCalc.getPosition(date, lat, lng);
    expect(position.azimuth).toBeDefined();
    expect(position.altitude).toBeDefined();
  });

  test("getTimes returns solarNoon and nadir", () => {
    const date = new Date("2023-07-20");
    const lat = 40.7128;
    const lng = -74.006;
    const height = 0;
    const times = SunCalc.getTimes(date, lat, lng, height);
    expect(times.solarNoon).toBeInstanceOf(Date);
    expect(times.nadir).toBeInstanceOf(Date);
  });

  test("getMoonPosition returns moon details", () => {
    const date = new Date("2023-07-20T12:00:00Z");
    const lat = 40.7128;
    const lng = -74.006;
    const moonPos = SunCalc.getMoonPosition(date, lat, lng);
    expect(moonPos.azimuth).toBeDefined();
    expect(moonPos.altitude).toBeDefined();
    expect(moonPos.distance).toBeDefined();
    expect(moonPos.parallacticAngle).toBeDefined();
  });

  test("getMoonIllumination returns fraction, phase, and angle", () => {
    const illumination = SunCalc.getMoonIllumination();
    expect(illumination.fraction).toBeGreaterThanOrEqual(0);
    expect(illumination.fraction).toBeLessThanOrEqual(1);
    expect(typeof illumination.phase).toBe("number");
    expect(typeof illumination.angle).toBe("number");
  });

  test("getMoonTimes returns rise and set times", () => {
    const date = new Date("2023-07-20");
    const lat = 40.7128;
    const lng = -74.006;
    const moonTimes = SunCalc.getMoonTimes(date, lat, lng);
    expect(moonTimes.rise).toBeInstanceOf(Date);
    expect(moonTimes.set).toBeInstanceOf(Date);
  });

  test("getPosition returns azimuth and altitude for the given time and location", () => {
    const date = new Date("2013-03-05T00:00:00Z");
    const lat = 50.5;
    const lng = 30.5;
    const sunPos = SunCalc.getPosition(date, lat, lng);
    expect(Math.abs(sunPos.azimuth + 2.5003175907168385)).toBeLessThan(1e-15);
    expect(Math.abs(sunPos.altitude + 0.7000406838781611)).toBeLessThan(1e-15);
  });

  test("getTimes returns sun phases for the given date and location", () => {
    const date = new Date("2013-03-05T00:00:00Z");
    const lat = 50.5;
    const lng = 30.5;
    const height = 0;
    const testTimes: { [key: string]: string } = {
      solarNoon: "2013-03-05T10:10:57Z",
      nadir: "2013-03-04T22:10:57Z",
      sunrise: "2013-03-05T04:34:56Z",
      sunset: "2013-03-05T15:46:57Z",
      sunriseEnd: "2013-03-05T04:38:19Z",
      sunsetStart: "2013-03-05T15:43:34Z",
      dawn: "2013-03-05T04:02:17Z",
      dusk: "2013-03-05T16:19:36Z",
      nauticalDawn: "2013-03-05T03:24:31Z",
      nauticalDusk: "2013-03-05T16:57:22Z",
      nightEnd: "2013-03-05T02:46:17Z",
      night: "2013-03-05T17:35:36Z",
      goldenHourEnd: "2013-03-05T05:19:01Z",
      goldenHour: "2013-03-05T15:02:52Z",
    };
    const times = SunCalc.getTimes(date, lat, lng, height);
    for (const key in testTimes) {
      expect(new Date(testTimes[key]).toUTCString()).toBe((times as any)[key].toUTCString());
    }
  });

  test("getTimes adjusts sun phases when additionally given the observer height", () => {
    const date = new Date("2013-03-05T00:00:00Z");
    const lat = 50.5;
    const lng = 30.5;
    const height = 2000;
    const heightTestTimes: { [key: string]: string } = {
      solarNoon: "2013-03-05T10:10:57Z",
      nadir: "2013-03-04T22:10:57Z",
      sunrise: "2013-03-05T04:25:07Z",
      sunset: "2013-03-05T15:56:46Z",
    };
    const times = SunCalc.getTimes(date, lat, lng, height);
    for (const key in heightTestTimes) {
      expect(new Date(heightTestTimes[key]).toUTCString()).toBe((times as any)[key].toUTCString());
    }
  });

  test("getMoonPosition returns moon position data given time and location", () => {
    const date = new Date("2013-03-05T00:00:00Z");
    const lat = 50.5;
    const lng = 30.5;
    const moonPos = SunCalc.getMoonPosition(date, lat, lng);
    expect(Math.abs(moonPos.azimuth + 0.9783999522438226)).toBeLessThan(1e-15);
    expect(Math.abs(moonPos.altitude - 0.014551482243892251)).toBeLessThan(1e-15);
    expect(Math.abs(moonPos.distance - 364121.37256256194)).toBeLessThan(1e-15);
  });

  test("getMoonIllumination returns fraction and angle of moon's illuminated limb and phase", () => {
    const date = new Date("2013-03-05T00:00:00Z");
    const moonIllum = SunCalc.getMoonIllumination(date);
    expect(Math.abs(moonIllum.fraction - 0.4848068202456373)).toBeLessThan(1e-15);
    expect(Math.abs(moonIllum.phase - 0.7548368838538762)).toBeLessThan(1e-15);
    expect(Math.abs(moonIllum.angle - 1.6732942678578346)).toBeLessThan(1e-15);
  });

  test("getMoonTimes returns moon rise and set times", () => {
    const date = new Date("2013-03-04T00:00:00Z");
    const lat = 50.5;
    const lng = 30.5;
    const moonTimes = SunCalc.getMoonTimes(date, lat, lng, true);
    expect(moonTimes.rise.toUTCString()).toBe("Mon, 04 Mar 2013 23:54:29 GMT");
    expect(moonTimes.set.toUTCString()).toBe("Mon, 04 Mar 2013 07:47:58 GMT");
  });
});
