import { Migration } from "@mikro-orm/migrations";

export class Migration20260505000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "access_grant_db" ("id" serial primary key, "name" text not null, "auids" jsonb not null, "notes" text null);`
    );
    this.addSql(
      `alter table "media_override_db" add column "access_grant_id" integer null references "access_grant_db" ("id") on delete set null;`
    );
    this.addSql(
      `create index "media_override_db_access_grant_id_index" on "media_override_db" ("access_grant_id");`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "media_override_db_access_grant_id_index";`);
    this.addSql(`alter table "media_override_db" drop column if exists "access_grant_id";`);
    this.addSql(`drop table if exists "access_grant_db" cascade;`);
  }
}
