import { Loaded } from "@mikro-orm/postgresql";
import { AncillaryDataSource_db } from "server/database/models/_allModels";
import { globalValues } from "server/express/global";

export async function getAncillaryDataSourcesByDate(date: string): Promise<AncillaryDataSource[]> {
  const em = globalValues.orm.em.fork();

  const ancillaryDataSource_db: Loaded<AncillaryDataSource_db, never>[] = await em.find(
    AncillaryDataSource_db,
    { date },
    { orderBy: { source: "ASC" } }
  );

  if (!ancillaryDataSource_db) {
    return [];
  }

  return ancillaryDataSource_db.map((record) => record);
}

export async function getAncillaryDataSourceList(): Promise<AncillaryDataSourceList[]> {
  const em = globalValues.orm.em.fork();

  const ancillaryDataSource_db = await em.find(
    AncillaryDataSource_db,
    {},
    { orderBy: { date: "ASC", source: "ASC" }, fields: ["id", "date", "source", "type", "url"] }
  );

  return ancillaryDataSource_db ?? [];
}

export async function getAncillaryDataSourceById(id: number): Promise<AncillaryDataSource | null> {
  const em = globalValues.orm.em.fork();
  return em.findOne(AncillaryDataSource_db, { id });
}

export async function upsertAncillaryDataSource({
  id,
  date,
  source,
  type,
  url,
}: AncillaryDataUpsertRequest): Promise<{ record: AncillaryDataSource; isNew: boolean } | null> {
  const em = globalValues.orm.em.fork();

  if (id) {
    const existing = await em.findOne(AncillaryDataSource_db, { id: Number(id) });
    if (!existing) {
      return null;
    }

    existing.date = date;
    existing.source = source;
    existing.type = type;
    existing.url = url;
    await em.persistAndFlush(existing);
    return { record: existing, isNew: false };
  }

  const created = em.create(AncillaryDataSource_db, {
    date,
    source,
    type,
    url,
  });
  await em.persistAndFlush(created);
  return { record: created, isNew: true };
}

export async function deleteAncillaryDataSourceById(id: number): Promise<boolean> {
  const em = globalValues.orm.em.fork();
  const existing = await em.findOne(AncillaryDataSource_db, { id });
  if (!existing) {
    return false;
  }

  await em.removeAndFlush(existing);
  return true;
}
