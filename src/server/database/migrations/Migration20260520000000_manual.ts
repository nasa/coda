import { Migration } from "@mikro-orm/migrations";

export class Migration20260520000000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "pcd_audio_db" ("id" serial primary key, "source" text not null, "notes" text null, "audio_json" jsonb not null);`
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "pcd_audio_db" cascade;`);
  }
}
