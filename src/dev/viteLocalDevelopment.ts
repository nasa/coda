import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { UserConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import { sharedAuthPlugin } from "./viteSharedAuth";

/** Local HTTPS and shared auth; called only when starting the Vite dev server. */
export const localDevelopmentConfig = (rootDir: string): UserConfig => {
  const certDir = join(rootDir, ".local/certs");
  const keyDir = join(rootDir, ".local/private");
  const ca = join(rootDir, ".env.local.cert.pem");
  mkdirSync(certDir, { recursive: true });
  mkdirSync(keyDir, { recursive: true });

  return {
    plugins: [
      mkcert({
        hosts: ["coda-local.fit.nasa.gov"],
        savePath: join(rootDir, ".local/mkcert"),
        // Keep the paths already mounted by the Docker preview.
        certFileName: join(certDir, "nginx.crt"),
        keyFileName: join(keyDir, "nginx.key"),
      }),
      process.env.MOCK_USER !== "true" &&
        sharedAuthPlugin({
          authOrigin: `https://${process.env.AUTH_HOST || "emss-auth.fit.nasa.gov"}`,
          ca: existsSync(ca) ? readFileSync(ca, "utf8") : undefined,
        }),
    ],
    server: {
      allowedHosts: ["coda-local.fit.nasa.gov"],
      strictPort: true,
    },
  };
};
