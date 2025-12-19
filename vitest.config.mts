/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import { config as viteConfig } from "./vite.config.mts";

/**
 * Vitest configuration
 *
 * This extends the main Vite config but removes the React SWC plugin.
 * The React SWC plugin doesn't support TypeScript decorators (used by MikroORM),
 * so we rely on esbuild (already configured in vite.config.mts) for all TypeScript files during testing.
 */
export default defineConfig({
  // Inherit resolve aliases and esbuild config from vite config
  resolve: viteConfig.resolve,
  esbuild: viteConfig.esbuild,
  // Do not include plugins (avoids React SWC which breaks decorators)
  plugins: [],
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
});
