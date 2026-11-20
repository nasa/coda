import { EntitySchema, types as MikroTypes } from "@mikro-orm/postgresql";
import { AccessGrant_db } from "./AccessGrant.model";

export class MediaOverride_db implements MediaOverride {
  id!: number;
  date!: string;
  source!: Source;
  type!: MediaMedium;
  matchMode: MediaOverrideMatchMode = "exact";
  url!: string;
  accessGrantId?: number | null;
}

export const MediaOverride_dbSchema = new EntitySchema<MediaOverride_db>({
  class: MediaOverride_db,
  tableName: "media_override_db",
  properties: {
    id: { type: MikroTypes.integer, primary: true, autoincrement: true },
    date: { type: MikroTypes.text },
    source: { type: MikroTypes.text },
    type: { type: MikroTypes.text },
    matchMode: { type: MikroTypes.text, default: "exact" },
    url: { type: MikroTypes.text },
    accessGrantId: {
      kind: "m:1",
      type: AccessGrant_db.name,
      mapToPk: true,
      fieldName: "access_grant_id",
      nullable: true,
      deleteRule: "set null",
      foreignKeyName: "media_override_db_access_grant_id_fkey",
      index: "media_override_db_access_grant_id_index",
    },
  },
});
