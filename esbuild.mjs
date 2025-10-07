import dotenv from "dotenv";
dotenv.config({ override: true, quiet: true });
import { rmSync } from "fs";
import * as esbuild from "esbuild";
import { spawn } from "child_process";
import packageJSON from "./package.json" with { type: "json" };

// Remove the previous build directory
rmSync("./.local/express/dist", { recursive: true, force: true });

let serverProcess = null;

// Create a simple watch plugin
const watchPlugin = {
  name: "watch-plugin",
  setup(build) {
    build.onEnd((result) => {
      const timestamp = new Date().toLocaleTimeString();
      if (result.errors.length > 0) {
        console.error(`Build failed with ${result.errors.length} errors at ${timestamp}`);
      } else {
        console.log(`Build succeeded at ${timestamp}`);

        // If in watch mode, manage server
        if (process.argv.includes("--watch") && !result.errors.length) {
          if (serverProcess) {
            console.log("Restarting server...");

            // Try graceful shutdown first
            if (serverProcess.connected) {
              serverProcess.send("shutdown");
            }

            // Allow time for shutdown, then force kill if needed
            setTimeout(() => {
              // Force kill if still running
              if (serverProcess && !serverProcess.killed) {
                console.log("Server did not shut down gracefully, forcing kill");
                serverProcess.kill();
              }

              // Small delay before starting new server to ensure port release
              setTimeout(startServer, 1000);
            }, 1000);
          } else {
            console.log("Starting server...");
            startServer();
          }
        }
      }
    });
  },
};

// Simple server start function
function startServer() {
  const env = { ...process.env, NODE_EXTRA_CA_CERTS: "./.env.local.cert.pem" };
  if (process.env.MOCK_USER === "true") {
    env.MOCK_USER = "true";
  }

  serverProcess = spawn(
    "node",
    ["--enable-source-maps", "--inspect=8229", "./.local/express/dist/api.js"],
    {
      env,
      stdio: ["inherit", "inherit", "inherit", "ipc"],
    }
  );

  serverProcess.on("error", (err) => {
    console.error("Failed to start server:", err);
  });

  serverProcess.on("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      console.log(`Server process exited with code ${code}`);
    } else if (signal) {
      console.log(`Server process killed with signal ${signal}`);
    }
  });
}

// Run esbuild with the specified options
const context = await esbuild.context({
  entryPoints: ["src/server/express/server.ts"],
  bundle: true,
  sourcemap: true,
  format: "cjs",
  platform: "node",
  target: "node20",
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
  plugins: [watchPlugin],
  // build time variables
  define: {
    __APP_VERSION__: JSON.stringify(packageJSON.version),
    // In the pipeline, GIT_COMMIT will be populated when the ci job passes it in MAP_ENV_VARS_TO_BUILD_ARGS
    //   to give it to kaniko docker to use during build. However when running this locally
    //   with NO docker container, we need to set a default value of "localDev"
    __GIT_COMMIT__: JSON.stringify(process.env.GIT_COMMIT || "localDev"),
  },
});

// Handle watch mode
const isWatchMode = process.argv.includes("--watch");

if (isWatchMode) {
  console.log("Watch mode started at", new Date().toLocaleString());
  console.log("Watching for changes...");

  // Set up shutdown handler
  process.on("SIGINT", async () => {
    console.log("\nShutting down watch mode...");
    if (serverProcess) {
      if (serverProcess.connected) {
        serverProcess.send("shutdown");
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      if (!serverProcess.killed) {
        serverProcess.kill();
      }
    }
    await context.dispose();
    process.exit(0);
  });

  await context.watch();
} else {
  console.log("Running single build at", new Date().toLocaleString());
  await context.rebuild();
  await context.dispose();
}
