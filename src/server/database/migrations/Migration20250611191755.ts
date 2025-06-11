import { Migration } from "@mikro-orm/migrations";

export class Migration20250611191755 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "cache_db" ("id" serial primary key, "folder" text not null, "cache_key" text not null, "data" jsonb null, "metadata" jsonb not null, "created_at" timestamptz(3) not null, "last_accessed_at" timestamptz(3) not null);`
    );
    this.addSql(`create index "cache_db_folder_index" on "cache_db" ("folder");`);
    this.addSql(`create index "cache_db_cache_key_index" on "cache_db" ("cache_key");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cache_db" cascade;`);
  }
}
