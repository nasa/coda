import { Migration } from "@mikro-orm/migrations";

export class Migration20251120122600 extends Migration {
  override async up(): Promise<void> {
    // Clear ephemeris cache to prevent stale data
    this.addSql(`delete from "cache_db" where "cache_key" = 'ephemeris';`);

    // Create ephemeris_db table
    this.addSql(
      `create table "ephemeris_db" ("epoch" timestamptz(3) not null, "tle_line1" text not null, "tle_line2" text not null, "origin" varchar(20) not null, "created_at" timestamptz(3) not null default now(), constraint "ephemeris_db_pkey" primary key ("epoch"));`
    );
    this.addSql(`create index "ephemeris_db_epoch_index" on "ephemeris_db" ("epoch");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ephemeris_db" cascade;`);
  }
}
