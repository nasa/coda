import { request as httpRequest } from "node:http";
import type { ClientRequest, IncomingMessage } from "node:http";
import { Agent, request as httpsRequest } from "node:https";
import { rootCertificates } from "node:tls";
import type { Plugin } from "vite";

interface SharedAuthOptions {
  authOrigin: string;
  ca?: string;
  publicOrigin?: string;
}

const isIdentityHeader = (name: string): boolean =>
  ["authorization", "x-access-token", "x-user", "x-email", "x-forwarded-access-token"].includes(
    name.toLowerCase()
  ) || name.toLowerCase().startsWith("x-auth-request-");

const protectedApi = (path: string): boolean =>
  !path.startsWith("/api/v1/db/ephemeris/recent") &&
  [
    "/api/v1/user/current",
    "/api/v1/db",
    "/api/v1/emss",
    "/api/v1/restricted",
    "/api/v1/profile",
    "/api/v1/log/from-client",
  ].some((prefix) => path.startsWith(prefix));

/** Supply nginx's shared-auth check and trusted JWT header during Vite development. */
export const sharedAuthPlugin = (options: SharedAuthOptions): Plugin => ({
  name: "coda-shared-auth",
  apply: (_config, env) => env.command === "serve" && env.mode !== "test",
  configureServer(server) {
    const authOrigin = new URL(options.authOrigin);
    const secure = authOrigin.protocol === "https:";
    if (secure && !server.config.server.https) {
      throw new Error("Shared auth requires HTTPS. Run bash ./scripts/make-dev-ssl-cert.sh first.");
    }
    const port = server.config.server.port || 3000;
    const origin =
      options.publicOrigin || `https://coda-local.fit.nasa.gov${port === 443 ? "" : `:${port}`}`;
    const agent = new Agent({ ca: options.ca ? [...rootCertificates, options.ca] : undefined });
    server.httpServer?.once("close", () => agent.destroy());
    const proxies = server.config.server.proxy;
    const api = proxies?.["/api/v1"];
    if (!proxies || !api || typeof api === "string") {
      throw new Error("Shared auth requires the /api/v1 Vite proxy configuration.");
    }

    // Let Vite proxy the OAuth redirects, userinfo, and cookies normally.
    proxies["/oauth2/"] = {
      target: options.authOrigin,
      changeOrigin: true,
      agent: secure ? agent : undefined,
      proxyTimeout: 10000,
      configure(proxy) {
        proxy.on("proxyRes", (response) => {
          delete response.headers["x-auth-request-access-token"];
          delete response.headers.authorization;
        });
      },
    };
    const configureApi = api.configure;
    api.configure = (proxy, proxyOptions) => {
      configureApi?.(proxy, proxyOptions);
      proxy.on("proxyReq", (outgoing, req) => {
        const token = req.headers["x-access-token"];
        if (token) {
          // The JWT decoder requires this exact spelling in rawHeaders.
          outgoing.removeHeader("x-access-token");
          outgoing.setHeader("X-Access-Token", token);
        }
        outgoing.setHeader("X-Real-IP", req.socket.remoteAddress || "");
      });
      proxy.on("proxyRes", (upstream, _req, response) => {
        const cookies = response.getHeader("Set-Cookie");
        if (Array.isArray(cookies)) {
          upstream.headers["set-cookie"] = [...(upstream.headers["set-cookie"] || []), ...cookies];
        }
      });
      // WebSocket upgrades bypass HTTP middleware; never trust their supplied identity headers.
      proxy.on("proxyReqWs", (outgoing: ClientRequest) => {
        for (const name of outgoing.getHeaderNames()) {
          if (isIdentityHeader(name)) outgoing.removeHeader(name);
        }
      });
    };

    server.middlewares.use((req, res, next) => {
      for (const name of Object.keys(req.headers)) {
        if (isIdentityHeader(name)) delete req.headers[name];
      }
      const path = new URL(req.url || "/", origin).pathname;
      if (path === "/logout") {
        res.writeHead(302, { Location: "/oauth2/sign_out?rd=%2Flogin" });
        res.end();
        return;
      }
      const login = path === "/login";
      const document =
        !path.startsWith("/api/") &&
        (req.method === "GET" || req.method === "HEAD") &&
        (path === "/" || path === "/index.html" || req.headers.accept?.includes("text/html"));
      if (path.startsWith("/oauth2/") || (!login && !document && !protectedApi(path))) {
        next();
        return;
      }

      const authenticate = async (): Promise<void> => {
        const auth = await new Promise<IncomingMessage>((done, reject) => {
          const request = secure ? httpsRequest : httpRequest;
          const outgoing = request(
            new URL("/oauth2/auth", authOrigin),
            { headers: { Cookie: req.headers.cookie || "" }, agent: secure ? agent : undefined },
            (response) => {
              response.resume();
              done(response);
            }
          );
          outgoing.on("error", reject);
          outgoing.setTimeout(10000, () => outgoing.destroy(new Error("Shared auth timed out")));
          outgoing.end();
        });
        const cookies = auth.headers["set-cookie"];
        if (cookies) res.setHeader("Set-Cookie", cookies);
        res.setHeader("Cache-Control", "no-store");
        if (auth.statusCode === 401) {
          res.writeHead(302, {
            Location: `/oauth2/sign_in?rd=${encodeURIComponent(origin + req.url)}`,
          });
          res.end();
          return;
        }
        if (auth.statusCode === 403) {
          res.writeHead(403);
          res.end("Access denied by shared authentication.");
          return;
        }
        const token = auth.headers["x-auth-request-access-token"];
        if (
          !auth.statusCode ||
          auth.statusCode < 200 ||
          auth.statusCode >= 300 ||
          typeof token !== "string" ||
          !token
        ) {
          throw new Error("Shared auth did not supply a validated access token");
        }
        if (login) {
          res.end("Signed in. You can close this window.");
          return;
        }
        req.headers["x-access-token"] = token;
        next();
      };
      void authenticate().catch(() => {
        if (res.writableEnded || res.destroyed) return;
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Shared authentication is unavailable. Please retry.");
      });
    });
  },
});
