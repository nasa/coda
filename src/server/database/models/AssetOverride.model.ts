import { EntitySchema, types as MikroTypes } from "@mikro-orm/postgresql";

export class AssetOverride_db implements AssetOverride {
  id!: number;
  mediaType!: AssetOverrideMediaType;
  source!: Source;
  startDate!: string;
  endDate!: string;
  overrideJson!: Record<string, string | number>;
  notes?: string;
}

export const AssetOverride_dbSchema = new EntitySchema<AssetOverride_db>({
  class: AssetOverride_db,
  tableName: "asset_override_db",
  indexes: [
    {
      properties: ["mediaType", "source", "startDate", "endDate"],
      name: "asset_override_db_lookup_index",
    },
  ],
  properties: {
    id: { type: MikroTypes.integer, primary: true, autoincrement: true },
    mediaType: { type: MikroTypes.text },
    source: { type: MikroTypes.text },
    startDate: { type: MikroTypes.text },
    endDate: { type: MikroTypes.text },
    overrideJson: { type: MikroTypes.json },
    notes: { type: MikroTypes.text, nullable: true },
  },
});
