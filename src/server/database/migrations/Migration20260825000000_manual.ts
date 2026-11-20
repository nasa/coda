import { Migration } from "@mikro-orm/migrations";

export class Migration20260825000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "access_grant_db" ("id" serial primary key, "name" text not null, "auids" jsonb not null, "notes" text null);`
    );
    this.addSql(
      `alter table "media_override_db" add column if not exists "access_grant_id" integer null references "access_grant_db" ("id") on delete set null;`
    );
    this.addSql(
      `create index if not exists "media_override_db_access_grant_id_index" on "media_override_db" ("access_grant_id");`
    );
    this.addSql(
      `alter table "media_override_db" add column "match_mode" text not null default 'exact';`
    );
    this.addSql(
      `alter table "media_override_db" add constraint "media_override_db_match_mode_check" check ("match_mode" in ('exact', 'daily'));`
    );
    this.addSql(
      `create index "media_override_db_lookup_index" on "media_override_db" ("source", "type", "match_mode", "date");`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "media_override_db_lookup_index";`);
    this.addSql(
      `alter table "media_override_db" drop constraint if exists "media_override_db_match_mode_check";`
    );
    this.addSql(`alter table "media_override_db" drop column if exists "match_mode";`);
    this.addSql(`drop index if exists "media_override_db_access_grant_id_index";`);
    this.addSql(`alter table "media_override_db" drop column if exists "access_grant_id";`);
    this.addSql(`drop table if exists "access_grant_db";`);
  }
}
