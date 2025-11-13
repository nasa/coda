import { Migration } from "@mikro-orm/migrations";

export class Migration20251106000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`delete from "cache_db";`);
  }

  override async down(): Promise<void> {
    // This migration deletes all cache data, so there is no down migration to restore it
  }
}
