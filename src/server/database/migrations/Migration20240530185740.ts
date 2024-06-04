import { Migration } from "@mikro-orm/migrations";

export class Migration20240530185740 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table "gpxtracks_db" ("id" serial primary key, "date" text not null, "name" text not null, "gpx_data" text not null);'
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "gpxtracks_db" cascade;');
  }
}
