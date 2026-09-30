/** Install local stand-ins for optional private `@emss/*` packages. */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDirectory = path.join(dirname, "packages");
const installDirectory = path.resolve(dirname, "../node_modules/@emss");

const realPackagesAreInstalled = () => {
  const manifestPath = path.join(installDirectory, "utils", "package.json");
  if (!existsSync(manifestPath)) return false;

  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")).codaFallback !== true;
  } catch {
    return false;
  }
};

if (realPackagesAreInstalled()) {
  console.log("[emss-fallback] Real @emss packages detected; using them.");
} else {
  mkdirSync(installDirectory, { recursive: true });
  for (const packageName of readdirSync(packagesDirectory)) {
    cpSync(path.join(packagesDirectory, packageName), path.join(installDirectory, packageName), {
      recursive: true,
    });
  }
  console.log("[emss-fallback] Installed @emss fallback packages for public development.");
}