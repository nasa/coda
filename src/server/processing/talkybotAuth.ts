import type { EmssUser } from "@emss/oauth2-proxy-common";

export function getTalkybotRequestHeaders(user: EmssUser, token: string): Record<string, string> {
  const roles = typeof user.roles === "string" ? [user.roles] : (user.roles ?? []);
  return {
    "x-api-key": token,
    "x-coda-viewer-auid": user.auid,
    "x-coda-viewer-superuser": String(roles.includes("EMSS-Superuser")),
  };
}
