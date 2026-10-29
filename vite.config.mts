/// <reference types="vitest/config" />
import dotenv from "dotenv";
dotenv.config({ override: true, quiet: true });
import { UserConfig, defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import packageJSON from "./package.json" with { type: "json" };
import { existsSync, readFileSync } from "node:fs";
import { sharedAuthPlugin } from "./src/dev/viteSharedAuth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const devCert = path.join(__dirname, ".local/certs/nginx.crt");
const devKey = path.join(__dirname, ".local/private/nginx.key");
const nasaCa = path.join(__dirname, ".env.local.cert.pem");

export const config: UserConfig = {
  root: "./src",
  envDir: "../",
  plugins: [
    react(),
    process.env.MOCK_USER !== "true" &&
      sharedAuthPlugin({
        authOrigin: `https://${process.env.AUTH_HOST || "emss-auth.fit.nasa.gov"}`,
        ca: existsSync(nasaCa) ? readFileSync(nasaCa, "utf8") : undefined,
      }),
  ],

  resolve: {
    //alias paths so that the import statements are shorter and start from the src folder
    alias: {
      components: path.resolve(__dirname, "./src/components"),
      packages: path.resolve(__dirname, "./src/packages"),
      pages: path.resolve(__dirname, "./src/pages"),
      public: path.resolve(__dirname, "./src/public"),
      server: path.resolve(__dirname, "./src/server"),
      store: path.resolve(__dirname, "./src/store"),
      typings: path.resolve(__dirname, "./src/typings"),
      utils: path.resolve(__dirname, "./src/utils"),
      stream: "stream-browserify", //for plotly.js
    },
  },
  //server configurations for running vite as a server (only happens in local dev). On docker/production, nginx serves the front end
  server: {
    // Use the same local certificate as the Docker preview for shared auth cookies.
    https:
      existsSync(devCert) && existsSync(devKey)
        ? { cert: readFileSync(devCert), key: readFileSync(devKey) }
        : undefined,
    allowedHosts: ["coda-local.fit.nasa.gov"],
    strictPort: true,
    // neither of these proxies are hit when running under docker:dev because nginx intercepts them
    proxy: {
      "/api/v1": {
        target: "http://127.0.0.1:3001/",
        changeOrigin: true,
        ws: true,
      },
      "/static": {
        target: "http://127.0.0.1:3001/",
        changeOrigin: true,
      },
    },
    watch: {
      // During development, ignore these folders for hot reloading
      ignored: ["**/node_modules/**", "**/.local/**", "**/public/**, **/static/**"],
    },
    host: "0.0.0.0", // all hosts
    port: 3000,
  },
  build: {
    outDir: "../.local/vite/dist",
    assetsDir: "assets",
    sourcemap: true,
    manifest: true,
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        // Creates separate bundles for each of these chunks so there isn't one huge bundle.js file
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules\/(react|react-dom|react-redux|react-router|@reduxjs\/toolkit|react-modal|react-cookie)\//,
            },
            {
              name: "plotly",
              test: /node_modules\/plotly\.js-basic-dist\//,
            },
            {
              name: "mapbox",
              test: /node_modules\/mapbox-gl\//,
            },
            {
              name: "fonts",
              test: /node_modules\/@fortawesome\//,
            },
            {
              name: "paper",
              test: /node_modules\/paper\//,
            },
          ],
        },
      },
      external: ["path", "os", "crypto"],
    },
  },
  // build time variables
  define: {
    global: {},
    __APP_VERSION__: JSON.stringify(packageJSON.version),
    // In the pipeline, GIT_COMMIT will be populated when the ci job passes it in MAP_ENV_VARS_TO_BUILD_ARGS
    //   to give it to kaniko docker to use during build. However when running this locally
    //   with NO docker container, we need to set a default value of "localDev"
    __GIT_COMMIT__: JSON.stringify(process.env.GIT_COMMIT || "localDev"),
  },
};

// https://vitejs.dev/config/
export default defineConfig(config);
