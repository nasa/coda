import { Entity, PrimaryKey, Property, Index } from "@mikro-orm/postgresql";
import { types as MikroTypes } from "@mikro-orm/postgresql";

@Entity()
@Index({ properties: ["epoch"] })
export class Ephemeris_db implements Ephemeris_db_type {
  @PrimaryKey({ type: MikroTypes.datetime, length: 3 })
  epoch!: Date;

  @Property({ type: MikroTypes.text })
  tle_line1!: string;

  @Property({ type: MikroTypes.text })
  tle_line2!: string;

  @Property({ type: MikroTypes.string, length: 20 })
  origin!: "celestrak" | "seed";

  @Property({ type: MikroTypes.datetime, length: 3, defaultRaw: "now()" })
  createdAt!: Date;
}
