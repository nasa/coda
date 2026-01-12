import { globalValues } from "server/express/global";
import { Loaded } from "@mikro-orm/postgresql";
import { GPXTracks_db } from "server/database/models/gpxTracks.model";
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
    };
  }
}

export async function getGpxTrackRecordsByDate(date: string): Promise<GPXTrackRecord[]> {
  const em = globalValues.orm.em.fork();

  const gpxTracks_db: Loaded<GPXTracks_db, never>[] = await em.find(
    GPXTracks_db,
    { date },
    { orderBy: { name: "ASC" } }
  );

  if (!gpxTracks_db) {
    return [];
  }

  return gpxTracks_db.map((record) => record);
}

export async function getGpxTrackRecordsList(): Promise<GPXTrackListRecord[]> {
  const em = globalValues.orm.em.fork();
  const gpxTracks_db = await em.find(
    GPXTracks_db,
    {},
    { orderBy: { date: "ASC", name: "ASC" }, fields: ["id", "date", "name"] }
  );

  return gpxTracks_db ?? [];
}

export async function getGpxTrackRecordById(id: number): Promise<GPXTrackRecord | null> {
  const em = globalValues.orm.em.fork();
  return em.findOne(GPXTracks_db, { id });
}

export async function upsertGpxTrackRecord({
  id,
  date,
  name,
  gpxData,
}: GPSUpsertRequest): Promise<{ record: GPXTrackRecord; isNew: boolean } | null> {
  const em = globalValues.orm.em.fork();

  if (id) {
    const existing = await em.findOne(GPXTracks_db, { id: Number(id) });
    if (!existing) {
      return null;
    }

    existing.date = date;
    existing.name = name;
    existing.gpxData = gpxData;
    await em.persistAndFlush(existing);
    return { record: existing, isNew: false };
  }

  const created = em.create(GPXTracks_db, { date, name, gpxData });
  await em.persistAndFlush(created);
  return { record: created, isNew: true };
}

export async function deleteGpxTrackRecordById(id: number): Promise<boolean> {
  const em = globalValues.orm.em.fork();
  const existing = await em.findOne(GPXTracks_db, { id });
  if (!existing) {
    return false;
  }

  await em.removeAndFlush(existing);
  return true;
}

const makeGPSTracks = (gpxTrackRecords: GPXTrackRecord[]): GPSTrack[] => {
  const gpsTracks: GPSTrack[] = gpxTrackRecords?.map((gpxTrackRecord) => {
    const gpxXml = gpxTrackRecord.gpxData;
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      allowBooleanAttributes: true,
    });

    const parsed = parser.parse(gpxXml);

    const gpsPoints: GPSPoint[] = parsed.gpx.trk.trkseg.trkpt.map(
      (point: { lat: string; lon: string; ele: string; time: string }) => ({
        lat: parseFloat(point.lat),
        lon: parseFloat(point.lon),
        ele: point.ele,
        time: point.time,
      })
    );

    return {
      name: gpxTrackRecord.name,
      points: gpsPoints,
    };
  });

  return gpsTracks;
};
