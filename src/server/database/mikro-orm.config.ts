import "../../utils/loadEnv.js";

import path from "node:path";
import { fileURLToPath } from "node:url";

import { PostgreSqlDriver, defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { SeedManager } from "@mikro-orm/seeder";

import { GPXTracks_dbSchema } from "./models/gpxTracks.model";
import { MediaOverride_dbSchema } from "./models/mediaOverride.model";
import { AncillaryDataSource_dbSchema } from "./models/ancillaryData.model";
import { VideoStartTimeOverrides_dbSchema } from "./models/VideoStartTimeOverrides.model";
import { PhotoTimeShifts_dbSchema } from "./models/PhotoTimeShifts.model";
import { AssetOverride_dbSchema } from "./models/AssetOverride.model";
import { AccessGrant_dbSchema } from "./models/AccessGrant.model";
import { Cache_dbSchema } from "./models/cache.model";
import { Ephemeris_dbSchema } from "./models/ephemera.model";
import { PcdAudio_dbSchema } from "./models/PcdAudio.model";

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
  entities: [
    GPXTracks_dbSchema,
    MediaOverride_dbSchema,
    AncillaryDataSource_dbSchema,
    VideoStartTimeOverrides_dbSchema,
    PhotoTimeShifts_dbSchema,
    AssetOverride_dbSchema,
    AccessGrant_dbSchema,
    Cache_dbSchema,
    Ephemeris_dbSchema,
    PcdAudio_dbSchema,
  ],
  debug: process.env.DEBUG === "true" || process.env.DEBUG?.includes("db"),
  allowGlobalContext: false,
  extensions: [Migrator, SeedManager],
});
