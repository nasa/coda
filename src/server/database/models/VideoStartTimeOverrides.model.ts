import { Entity, PrimaryKey, Property } from "@mikro-orm/postgresql";
import { types as MikroTypes } from "@mikro-orm/postgresql";

@Entity()
export class VideoStartTimeOverrides_db implements VideoRecord_db_type {
  @PrimaryKey({ type: MikroTypes.integer })
  id!: number;

  @Property({ type: MikroTypes.string })
  videoId!: string;
  @Property({ type: MikroTypes.string })
  startTime!: string;
}
