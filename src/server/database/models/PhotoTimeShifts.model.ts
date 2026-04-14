import { EntitySchema, types as MikroTypes } from "@mikro-orm/postgresql";

export class PhotoTimeShifts_db implements PhotoRecord {
  id!: number;
  date!: string;
  source!: string;
  nasaIdRegex!: string;
  timeOffset!: string;
}

export const PhotoTimeShifts_dbSchema = new EntitySchema<PhotoTimeShifts_db>({
  class: PhotoTimeShifts_db,
  tableName: "photo_time_shifts_db",
  properties: {
    id: { type: MikroTypes.integer, primary: true, autoincrement: true },
    date: { type: MikroTypes.text },
    source: { type: MikroTypes.text },
    nasaIdRegex: { type: MikroTypes.text, default: ".*" },
    timeOffset: { type: MikroTypes.text },
  },
});
