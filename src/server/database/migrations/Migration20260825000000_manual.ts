import { Migration } from "@mikro-orm/migrations";

export class Migration20260825000000 extends Migration {
  override async up(): Promise<void> {
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
  }
}
