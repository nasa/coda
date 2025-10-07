import { Entity, PrimaryKey, Property } from "@mikro-orm/postgresql";
import { types as MikroTypes } from "@mikro-orm/postgresql";

@Entity()
export class AncillaryDataSource_db implements AncillaryDataSource_db_type {
  @PrimaryKey({ type: MikroTypes.integer })
  id!: number;

  @Property({ type: MikroTypes.text })
  date!: string;
  @Property({ type: MikroTypes.text })
  source!: Source;
  @Property({ type: MikroTypes.text })
  type!: "graphs";
  @Property({ type: MikroTypes.text })
  url!: string;
}
