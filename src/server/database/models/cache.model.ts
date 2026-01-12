import { EntitySchema, types as MikroTypes } from "@mikro-orm/postgresql";

export class Cache_db implements CacheRecord {
  id!: number;
  folder!: string;
  cacheKey!: string;
  data!: unknown;
  metadata!: CacheMetadata;
  createdAt!: Date;
  lastAccessedAt!: Date;
}

export const Cache_dbSchema = new EntitySchema<Cache_db>({
  class: Cache_db,
  tableName: "cache_db",
  indexes: [
    { properties: ["folder"], name: "cache_db_folder_index" },
    { properties: ["cacheKey"], name: "cache_db_cache_key_index" },
  ],
  properties: {
    id: { type: MikroTypes.integer, primary: true, autoincrement: true },
    folder: { type: MikroTypes.text },
    cacheKey: { type: MikroTypes.text },
    data: { type: MikroTypes.json, nullable: true },
    metadata: { type: MikroTypes.json },
    createdAt: { type: MikroTypes.datetime, length: 3 },
    lastAccessedAt: { type: MikroTypes.datetime, length: 3 },
  },
});
