import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { types as MikroTypes } from "@mikro-orm/core";

@Entity()
export class GPXTracks_db implements GPXTrackRecord_db_type {
  @PrimaryKey({ type: MikroTypes.integer })
  id!: number;

  @Property({ type: MikroTypes.text })
  date!: string;
  @Property({ type: MikroTypes.text })
  name!: string;
  @Property({ type: MikroTypes.text })
  gpxData!: string;
}
