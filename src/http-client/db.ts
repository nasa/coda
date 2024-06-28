import { XMLParser } from "fast-xml-parser";
import { queryStringFromObject } from "utils/formatting";

export async function getGPSTracks(dateWanted: string): Promise<WrappedResponse<GPSTrack[]>> {
  try {
    const queryParams: GPSTracksQueryParams = {
      dateWanted,
    };
    const queryString = queryStringFromObject(queryParams);
    const res = await fetch(`/api/v1/db/gps?${queryString}`);
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
      const gpsPoints: GPSPoint[] = parsed.gpx.trk.trkseg.trkpt.map(
        (point: { lat: string; lon: string; ele: any; time: any }) => {
          const newGpsPoint: GPSPoint = {
            lat: parseFloat(point.lat),
            lon: parseFloat(point.lon),
            ele: point.ele,
            time: point.time,
          };
          return newGpsPoint;
        }
      );

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
        error: e.toString(),
        retrieverErrorCount: 0,
        lastErrorTimestamp: null,
      },
      source: "database",
      data: [],
    };
  }
}
