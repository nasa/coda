import { Entity, PrimaryKey, Property } from "@mikro-orm/postgresql";
import { types as MikroTypes } from "@mikro-orm/postgresql";

@Entity()
export class PhotoTimeShifts_db implements PhotoRecord_db_type {
  @PrimaryKey({ type: MikroTypes.integer })
  id!: number;

  @Property({ type: MikroTypes.text })
  date!: string;
  @Property({ type: MikroTypes.text })
  source!: string;
  @Property({ type: MikroTypes.text })
  timeOffset!: string;
}
