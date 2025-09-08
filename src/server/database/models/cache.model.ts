import { Entity, PrimaryKey, Property, Index, types as MikroTypes } from "@mikro-orm/postgresql";

@Entity()
export class Cache_db implements CacheRecord_db_type {
  @PrimaryKey({ type: MikroTypes.integer, autoincrement: true })
  id!: number;

  @Property({ type: MikroTypes.text })
  @Index()
  folder!: string;

  @Property({ type: MikroTypes.text })
  @Index()
  cacheKey!: string;

  @Property({ type: MikroTypes.json, nullable: true })
  data!: unknown;

  @Property({ type: MikroTypes.json })
  metadata!: CacheMetadata | SocketCacheMetadata;

  @Property({ type: MikroTypes.datetime, columnType: "timestamptz(3)" })
  createdAt!: Date;

  @Property({ type: MikroTypes.datetime, columnType: "timestamptz(3)" })
  lastAccessedAt!: Date;
}
