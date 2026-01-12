import { EntitySchema, types as MikroTypes } from "@mikro-orm/postgresql";

export class Ephemeris_db implements EphemerisRecord {
  epoch!: Date;
  tle_line1!: string;
  tle_line2!: string;
  origin!: "celestrak" | "seed";
  createdAt!: Date;
}

export const Ephemeris_dbSchema = new EntitySchema<Ephemeris_db>({
  class: Ephemeris_db,
  tableName: "ephemeris_db",
  indexes: [{ properties: ["epoch"], name: "ephemeris_db_epoch_index" }],
  properties: {
    epoch: { type: MikroTypes.datetime, primary: true, length: 3 },
    tle_line1: { type: MikroTypes.text },
    tle_line2: { type: MikroTypes.text },
    origin: { type: MikroTypes.string, length: 20 },
    createdAt: { type: MikroTypes.datetime, length: 3, defaultRaw: "now()" },
  },
});
