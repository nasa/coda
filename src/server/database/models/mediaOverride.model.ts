import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { types as MikroTypes } from "@mikro-orm/core";

@Entity()
export class MediaOverride_db implements MediaOverride_db_type {
  @PrimaryKey({ type: MikroTypes.integer })
  id!: number;

  @Property({ type: MikroTypes.text })
  date!: string;
  @Property({ type: MikroTypes.text })
  source!: Source;
  @Property({ type: MikroTypes.text })
  type!: MediaMedium;
  @Property({ type: MikroTypes.text })
  url!: string;
}
