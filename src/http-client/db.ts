import { XMLParser } from "fast-xml-parser";

export async function getGPSTracks(
  year: number,
  month: number,
  day: number
): Promise<WrappedResponse<GPSTrack[]>> {
  try {
    const res = await fetch(`/api/v1/db/gps?year=${year}&month=${month}&day=${day}`);
    const rawDbData: WrappedResponse<GPXTrackRecord[]> = await res.json();
    const gpsTracks: GPSTrack[] = rawDbData.data.map((GPXTrackRecord) => {
      // parse the gpx XML retreived from the wiki

      const gpxXml = GPXTrackRecord.gpxData;
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        allowBooleanAttributes: true,
      });

      const parsed = parser.parse(gpxXml);

      // create GPSTrack object from parsed XML
      const gpsPoints: GPSPoint[] = parsed.gpx.trk.trkseg.trkpt.map((point) => {
        const newGpsPoint: GPSPoint = {
          lat: parseFloat(point.lat),
          lon: parseFloat(point.lon),
          ele: point.ele,
          time: point.time,
        };
        return newGpsPoint;
      });

      const gpsTrack: GPSTrack = {
        name: GPXTrackRecord.name,
        points: gpsPoints,
      };
      return gpsTrack;
    });
    return {
      responseMetadata: {
        retrieverStatus: "complete",
        cachedTimestamp: null,
        expiration: null,
        error: null,
        retrieverErrorCount: 0,
        lastErrorTimestamp: null,
      },
      source: "database",
      data: gpsTracks,
    };
  } catch (e) {
    return {
      responseMetadata: {
        retrieverStatus: "complete",
        cachedTimestamp: null,
        expiration: null,
        error: e,
        retrieverErrorCount: 0,
        lastErrorTimestamp: null,
      },
      source: "database",
      data: [],
    };
  }
}
