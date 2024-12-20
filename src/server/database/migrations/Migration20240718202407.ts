import { Migration } from "@mikro-orm/migrations";

export class Migration20240718202407 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table "photo_time_shifts_db" ("id" serial primary key, "date" text not null, "source" text not null, "time_offset" text not null);'
    );

    this.addSql(
      'create table "video_start_time_overrides_db" ("id" serial primary key, "video_id" varchar(255) not null, "start_time" varchar(255) not null);'
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "photo_time_shifts_db" cascade;');

    this.addSql('drop table if exists "video_start_time_overrides_db" cascade;');
  }
}
