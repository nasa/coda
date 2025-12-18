import "../../utils/loadEnv.js";

import path from "node:path";
import { fileURLToPath } from "node:url";

import { PostgreSqlDriver, defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { SeedManager } from "@mikro-orm/seeder";

import {
  AncillaryDataSource_db,
  GPXTracks_db,
  MediaOverride_db,
  PhotoTimeShifts_db,
  VideoStartTimeOverrides_db,
  Cache_db,
  Ephemeris_db,
} from "./models/_allModels.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  dbName: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? "5432"),
  driver: PostgreSqlDriver,
  password: process.env.DB_PASS,
  migrations: {
    path: path.join(__dirname, "./migrations"), // path to the folder with migrations
    snapshot: false,
  },
  seeder: {
    path: path.join(__dirname, "./seeds"), // path to the folder with seed files
  },
  entitiesTs: [
    GPXTracks_db,
    MediaOverride_db,
    AncillaryDataSource_db,
    VideoStartTimeOverrides_db,
    PhotoTimeShifts_db,
    Cache_db,
    Ephemeris_db,
  ],
  entities: [
    GPXTracks_db,
    MediaOverride_db,
    AncillaryDataSource_db,
    VideoStartTimeOverrides_db,
    PhotoTimeShifts_db,
    Cache_db,
    Ephemeris_db,
  ],
  debug: process.env.DEBUG === "true" || process.env.DEBUG?.includes("db"),
  allowGlobalContext: true,
  extensions: [Migrator, SeedManager],
});
