/// <reference types="vitest/config" />
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.mts";

/**
 * Vitest configuration - extends the main Vite config
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    // Override root to run tests from project root, not src/
    root: ".",
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.spec.ts"],
      exclude: ["**/node_modules/**", "**/.local/**"],
      setupFiles: ["./vitest.setup.ts"],
      reporters: ["default", "junit"],
      outputFile: {
        junit: "./junit.xml",
      },
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov", "cobertura"],
        include: ["src/**/*.{js,jsx,ts,tsx}"],
        exclude: ["src/**/*.d.ts", "src/**/*.spec.ts"],
      },
      server: {
        deps: {
          inline: ["tle.js"],
        },
      },
      deps: {
        optimizer: {
          ssr: {
            include: ["@mikro-orm/*"],
          },
        },
      },
    },
  })
);
