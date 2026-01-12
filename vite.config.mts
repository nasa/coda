/// <reference types="vitest/config" />
import dotenv from "dotenv";
dotenv.config({ override: true, quiet: true });
import { UserConfig, defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react-swc";
import packageJSON from "./package.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ReactCompilerConfig = {
  // You can specify a target version: '17' | '18' | '19'
  target: "19",
};

export const config: UserConfig = {
  root: "./src",
  envDir: "../",
  plugins: [react()],

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
    // neither of these proxies are hit when running under docker:dev because nginx intercepts them
    proxy: {
      "/api/v1": {
        target: "http://localhost:3001/",
        changeOrigin: true,
        ws: true,
      },
      "/static": {
        target: "http://localhost:3001/",
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
    rollupOptions: {
      output: {
        // Creates a separate bundles for each of these chunks so there isn't one huge bundle.js file
        manualChunks: {
          react: [
            "react",
            "react-dom",
            "react-redux",
            "react-router",
            "@reduxjs/toolkit",
            "react-modal",
            "react-lazy-load-image-component",
            "react-cookie",
          ],
          plotly: ["plotly.js-basic-dist"],
          mapbox: ["mapbox-gl"],
          fonts: [
            "@fortawesome/fontawesome-svg-core",
            "@fortawesome/free-regular-svg-icons",
            "@fortawesome/free-solid-svg-icons",
            "@fortawesome/react-fontawesome",
          ],
          paper: ["paper"],
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
