import { rmSync } from "fs";
import * as esbuild from "esbuild";

// Remove the previous build directory
rmSync("./.local/express/dist", { recursive: true, force: true });

// Run esbuild with the specified options
const context = await esbuild.context({
  entryPoints: ["src/server/express/server.ts"],
  bundle: true,
  sourcemap: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  // esbuild will not bundle the following packages due to an esm/cjs conflict. This sets them as external to the bundler.
  external: [
    "@mikro-orm/mongodb",
    "@mikro-orm/mysql",
    "@mikro-orm/mariadb",
    "@mikro-orm/sqlite",
    "@mikro-orm/better-sqlite",
    "@mikro-orm/entity-generator",
    "sqlite3",
    "mysql",
    "mysql2",
    "better-sqlite3",
    "oracledb",
    "pg-query-stream",
    "mariadb",
    "libsql",
    "tedious",
  ],
  outfile: "./.local/express/dist/api.js",
  tsconfig: "./tsconfig.json",
});

const isWatchMode = process.argv.includes("--watch");

if (isWatchMode) {
  console.log("watching...");
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
