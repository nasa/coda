/// <reference types="vite/client" />
import { UserConfig, defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export const config: UserConfig = {
  root: "./src",
  envDir: "../",
  plugins: [react()],
  resolve: {
    //alias paths so that the import statements are shorter and start from the src folder
    alias: {
      components: path.resolve(__dirname, "./src/components"),
      "http-client": path.resolve(__dirname, "./src/http-client"),
      pages: path.resolve(__dirname, "./src/pages"),
      public: path.resolve(__dirname, "./src/public"),
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
        target: "http://localhost:2000/",
        changeOrigin: true,
        ws: true,
      },
      "/static": {
        target: "http://localhost:2000/",
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
            "react-router-dom",
            "@reduxjs/toolkit",
            "react-modal",
            "react-lazy-load-image-component",
            "react-cookie",
          ],
          plotly: ["plotly.js"],
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
  define: {
    global: {},
  },
};

// https://vitejs.dev/config/
export default defineConfig(config);
