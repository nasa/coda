import { loadEnvConfig } from "@next/env";

export default async (_globalSetup) => {
  console.log(""); // clears the line in the terminal before nextjs prints out messages about which .env files were loaded
  const projectDir = process.cwd();
  loadEnvConfig(projectDir);
};
