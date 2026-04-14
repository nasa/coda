import { Migration } from "@mikro-orm/migrations";

export class Migration20260414002547 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "photo_time_shifts_db" add column "nasa_id_prefix" text not null default '*';`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "photo_time_shifts_db" drop column "nasa_id_prefix";`);
  }
}
