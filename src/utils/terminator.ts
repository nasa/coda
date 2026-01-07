import type { FeatureCollection, Geometry } from "geojson";

function julian(date: Date): number {
  /* Calculate the present UTC Julian Date. Function is valid after
   * the beginning of the UNIX epoch 1970-01-01 and ignores leap
   * seconds. */
  return date.getTime() / 86400000 + 2440587.5;
}

function GMST(julianDay: number): number {
  /* Calculate Greenwich Mean Sidereal Time according to 
     http://aa.usno.navy.mil/faq/docs/GAST.php */
  const d = julianDay - 2451545.0;
  // Low precision equation is good enough for our purposes.
  return (18.697374558 + 24.06570982441908 * d) % 24;
}

type Options = {
  resolution: number;
  time: Date;
};

type Ecliptic = {
  lambda: number;
  R: number;
};

type SunPosition = {
  alpha: number;
  delta: number;
};

export default class Terminator {
  version: string;
  _R2D: number;
  _D2R: number;

  constructor(readonly options: Options = { resolution: 2, time: new Date() }) {
    this.version = "0.1.0";
    this._R2D = 180 / Math.PI;
    this._D2R = Math.PI / 180;
  }

  getTerminator(): FeatureCollection<Geometry> {
    const latLngs = this._compute();
    return this._toGeoJSON(latLngs);
  }

  setTime(date: Date): FeatureCollection<Geometry> {
    this.options.time = date;
    const latLngs = this._compute();
    return this._toGeoJSON(latLngs);
  }

  _toGeoJSON(latLngs: number[][]): FeatureCollection<Geometry> {
    /* Return 'pseudo' GeoJSON representation of the coordinates
      Why 'pseudo'?
      Coordinates longitude range go from -360 to 360
      whereas it should be -180, + 180
      API like OpenLayers or Leaflet can consume them although invalid
      from GeoJSON spec
      In this case, use something like GDAL/OGR to clip to a valid range with
      ogr2ogr -f "GeoJSON" output.geojson input.geojson \
      -clipsrc -180 90 180 90
    */
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                ...latLngs.map((latLng) => {
                  return [latLng[1], latLng[0]];
                }),
                [latLngs[0][1], latLngs[0][0]],
              ]
                .slice()
                .reverse(),
            ],
          },
        },
      ],
    };
  }

  _sunEclipticPosition(julianDay: number): Ecliptic {
    /* Compute the position of the Sun in ecliptic coordinates at
       julianDay.  Following
       http://en.wikipedia.org/wiki/Position_of_the_Sun */
    // Days since start of J2000.0
    const n = julianDay - 2451545.0;
    // mean longitude of the Sun
    const L = (280.46 + 0.9856474 * n) % 360;
    // mean anomaly of the Sun
    const g = (357.528 + 0.9856003 * n) % 360;
    // ecliptic longitude of Sun
    const lambda = L + 1.915 * Math.sin(g * this._D2R) + 0.02 * Math.sin(2 * g * this._D2R);
    // distance from Sun in AU
    const R = 1.00014 - 0.01671 * Math.cos(g * this._D2R) - 0.0014 * Math.cos(2 * g * this._D2R);
    return { lambda, R };
  }

  _eclipticObliquity(julianDay: number): number {
    // Following the short term expression in
    // http://en.wikipedia.org/wiki/Axial_tilt#Obliquity_of_the_ecliptic_.28Earth.27s_axial_tilt.29
    const n = julianDay - 2451545.0;
    // Julian centuries since J2000.0
    const T = n / 36525;
    const epsilon =
      23.43929111 -
      T *
        (46.836769 / 3600 -
          T *
            (0.0001831 / 3600 +
              T * (0.0020034 / 3600 - T * (0.576e-6 / 3600 - (T * 4.34e-8) / 3600))));
    return epsilon;
  }

  _sunEquatorialPosition(sunEclLng: number, eclObliq: number): SunPosition {
    /* Compute the Sun's equatorial position from its ecliptic
     * position. Inputs are expected in degrees. Outputs are in
     * degrees as well. */
    let alpha =
      Math.atan(Math.cos(eclObliq * this._D2R) * Math.tan(sunEclLng * this._D2R)) * this._R2D;
    const delta =
      Math.asin(Math.sin(eclObliq * this._D2R) * Math.sin(sunEclLng * this._D2R)) * this._R2D;

    const lQuadrant = Math.floor(sunEclLng / 90) * 90;
    const raQuadrant = Math.floor(alpha / 90) * 90;
    alpha = alpha + (lQuadrant - raQuadrant);

    return { alpha, delta };
  }

  _hourAngle(lng: number, sunPos: { alpha: number; delta?: number }, gst: number): number {
    /* Compute the hour angle of the sun for a longitude on
     * Earth. Return the hour angle in degrees. */
    const lst = gst + lng / 15;
    return lst * 15 - sunPos.alpha;
  }

  _latitude(ha: number, sunPos: { alpha?: number; delta: number }): number {
    /* For a given hour angle and sun position, compute the
     * latitude of the terminator in degrees. */
    const lat =
      Math.atan(-Math.cos(ha * this._D2R) / Math.tan(sunPos.delta * this._D2R)) * this._R2D;
    return lat;
  }

  _compute(): number[][] {
    const today = this.options.time ? new Date(this.options.time) : new Date();
    const julianDay = julian(today);
    const gst = GMST(julianDay);
    const latLng = [];
    const startMinus = -360;

    const sunEclPos = this._sunEclipticPosition(julianDay);
    const eclObliq = this._eclipticObliquity(julianDay);
    const sunEqPos = this._sunEquatorialPosition(sunEclPos.lambda, eclObliq);
    for (let i = 0; i <= 720 * this.options.resolution; i++) {
      const lng = startMinus + i / this.options.resolution;
      const ha = this._hourAngle(lng, sunEqPos, gst);
      latLng[i + 1] = [this._latitude(ha, sunEqPos), lng];
    }
    if (sunEqPos.delta < 0) {
      latLng[0] = [90, startMinus];
      latLng[latLng.length] = [90, 360];
    } else {
      latLng[0] = [-90, startMinus];
      latLng[latLng.length] = [-90, 360];
    }
    return latLng;
  }
}
