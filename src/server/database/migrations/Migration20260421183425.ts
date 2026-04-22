import { Migration } from "@mikro-orm/migrations";

export class Migration20260421183425 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "asset_override_db" ("id" serial primary key, "media_type" text not null, "source" text not null, "start_date" text not null, "end_date" text not null, "override_json" jsonb not null, "notes" text null);`
    );
    this.addSql(
      `create index "asset_override_db_lookup_index" on "asset_override_db" ("media_type", "source", "start_date", "end_date");`
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "asset_override_db" cascade;`);
  }
}
