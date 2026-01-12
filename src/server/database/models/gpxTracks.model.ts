import { EntitySchema, types as MikroTypes } from "@mikro-orm/postgresql";

export class GPXTracks_db implements GPXTrackRecord {
  id!: number;
  date!: string;
  name!: string;
  gpxData!: string;
}

export const GPXTracks_dbSchema = new EntitySchema<GPXTracks_db>({
  class: GPXTracks_db,
  tableName: "gpxtracks_db",
  properties: {
    id: { type: MikroTypes.integer, primary: true, autoincrement: true },
    date: { type: MikroTypes.text },
    name: { type: MikroTypes.text },
    gpxData: { type: MikroTypes.text },
  },
});
