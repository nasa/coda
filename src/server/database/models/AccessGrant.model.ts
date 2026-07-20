import { EntitySchema, types as MikroTypes } from "@mikro-orm/postgresql";

export class AccessGrant_db implements AccessGrant {
  id!: number;
  name!: string;
  auids!: string[];
  notes?: string;
}

export const AccessGrant_dbSchema = new EntitySchema<AccessGrant_db>({
  class: AccessGrant_db,
  tableName: "access_grant_db",
  properties: {
    id: { type: MikroTypes.integer, primary: true, autoincrement: true },
    name: { type: MikroTypes.text },
    auids: { type: MikroTypes.json },
    notes: { type: MikroTypes.text, nullable: true },
  },
});
