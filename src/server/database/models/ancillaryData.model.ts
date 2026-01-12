import { EntitySchema, types as MikroTypes } from "@mikro-orm/postgresql";

export class AncillaryDataSource_db implements AncillaryDataSource {
  id!: number;
  date!: string;
  source!: Source;
  type!: "graphs";
  url!: string;
}

export const AncillaryDataSource_dbSchema = new EntitySchema<AncillaryDataSource_db>({
  class: AncillaryDataSource_db,
  tableName: "ancillary_data_source_db",
  properties: {
    id: { type: MikroTypes.integer, primary: true, autoincrement: true },
    date: { type: MikroTypes.text },
    source: { type: MikroTypes.text },
    type: { type: MikroTypes.text },
    url: { type: MikroTypes.text },
  },
});
