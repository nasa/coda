import { Migration } from "@mikro-orm/migrations";

export class Migration20240710153247 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table "ancillary_data_source_db" ("id" serial primary key, "date" text not null, "source" text not null, "type" text not null, "url" text not null);'
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "ancillary_data_source_db" cascade;');
  }
}
