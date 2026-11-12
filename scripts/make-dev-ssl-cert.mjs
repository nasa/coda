import { fileURLToPath } from "node:url";
import { resolveConfig } from "vite";

// Resolve the dev plugins to generate the certificate without starting a server.
process.chdir(fileURLToPath(new URL("..", import.meta.url)));
await resolveConfig({}, "serve");
