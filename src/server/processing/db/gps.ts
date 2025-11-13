import { getEM } from "utils/mikro";
import { Loaded } from "@mikro-orm/postgresql";
import { GPXTracks_db } from "server/database/models/_allModels";
import { XMLParser } from "fast-xml-parser";

export default async function getGpsTrackData({
  dateWanted,
}: {
  dateWanted: string;
}): Promise<FetchResponse<GPSTrack[]>> {
  try {
    const gpxTrackRecords = await getGpxTrackRecordsByDate(dateWanted);
    const gpsTracks = gpxTrackRecords ? makeGPSTracks(gpxTrackRecords) : [];

    const timestamp = new Date().toISOString();
    return {
      data: gpsTracks,
      fetchMetadata: {
        success: true,
        error: undefined,
        timestamp,
      },
      source: "database",
    };
  } catch (error) {
    const timestamp = new Date().toISOString();
    return {
      data: [],
      fetchMetadata: {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error fetching GPS data",
        timestamp,
      },
      source: "database",
    };
  }
}

export async function getGpxTrackRecordsByDate(date: string): Promise<GPXTrackRecord[]> {
  const em = getEM();

  let gpxTracks_db: Loaded<GPXTracks_db, never>[];
  gpxTracks_db = await em.find(GPXTracks_db, { date: date }, { orderBy: { name: "ASC" } });
  if (gpxTracks_db) {
    const gpsTrackRecordData: GPXTrackRecord[] = gpxTracks_db.map((gpxTrackRecord) => {
      const gpsTrackRecordData = gpxTrackRecord;
      return gpsTrackRecordData;
    });
    return gpsTrackRecordData;
  } else {
    return [];
  }
}

export async function getGpxTrackRecordsList(): Promise<GPXTrackListRecord[]> {
  const em = getEM();

  const gpxTracks_db = await em.find(
    GPXTracks_db,
    {},
    { orderBy: { date: "ASC", name: "ASC" }, fields: ["id", "date", "name"] }
  );
  if (gpxTracks_db) {
    return gpxTracks_db;
  } else {
    return [];
  }
}

const makeGPSTracks = (gpxTrackRecords: GPXTrackRecord[]): GPSTrack[] => {
  const gpsTracks: GPSTrack[] = gpxTrackRecords?.map((GPXTrackRecord) => {
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
  return gpsTracks;
};
