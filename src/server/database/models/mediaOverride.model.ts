import { EntitySchema, types as MikroTypes } from "@mikro-orm/postgresql";

export class MediaOverride_db implements MediaOverride {
  id!: number;
  date!: string;
  source!: Source;
  type!: MediaMedium;
  url!: string;
}

export const MediaOverride_dbSchema = new EntitySchema<MediaOverride_db>({
  class: MediaOverride_db,
  tableName: "media_override_db",
  properties: {
    id: { type: MikroTypes.integer, primary: true, autoincrement: true },
    date: { type: MikroTypes.text },
    source: { type: MikroTypes.text },
    type: { type: MikroTypes.text },
    url: { type: MikroTypes.text },
  },
});
