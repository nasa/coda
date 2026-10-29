import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import type {
  ClientRequest,
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { Agent, request as httpsRequest } from "node:https";
import { resolve } from "node:path";
import { rootCertificates } from "node:tls";
import type { Plugin, ProxyOptions } from "vite";

interface SharedAuthOptions {
  authOrigin: string;
  ca?: string;
  publicOrigin?: string;
  timeoutMs?: number;
}

interface AuthResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

interface Identity {
  token: string;
  user?: string;
  email?: string;
  cookies?: string[];
}

const isIdentityHeader = (name: string): boolean =>
  ["authorization", "x-access-token", "x-user", "x-email", "x-forwarded-access-token"].includes(
    name.toLowerCase()
  ) || name.toLowerCase().startsWith("x-auth-request-");

const protectedApi = (pathname: string): boolean => {
  // This key-authenticated endpoint is explicitly public in nginx.
  if (pathname.startsWith("/api/v1/db/ephemeris/recent")) return false;
  return [
    "/api/v1/user/current",
    "/api/v1/db",
    "/api/v1/emss",
    "/api/v1/restricted",
    "/api/v1/profiler",
    "/api/v1/profile",
    "/api/v1/log/from-client",
  ].some((prefix) => pathname.startsWith(prefix));
};

/** The local equivalent of nginx's shared-auth subrequest and trusted JWT forwarding. */
export const sharedAuthPlugin = (options: SharedAuthOptions): Plugin => ({
  name: "coda-shared-auth",
  apply: (_config, env) => env.command === "serve" && env.mode !== "test",
  configureServer(server) {
    const authOrigin = new URL(options.authOrigin);
    if (authOrigin.protocol === "https:" && !server.config.server.https) {
      throw new Error("Shared auth requires HTTPS. Run bash ./scripts/make-dev-ssl-cert.sh first.");
    }
    const port = server.config.server.port || 3000;
    const publicOrigin =
      options.publicOrigin || `https://coda-local.fit.nasa.gov${port === 443 ? "" : `:${port}`}`;
    const agent = new Agent({
      keepAlive: true,
      ca: options.ca ? [...rootCertificates, options.ca] : undefined,
    });
    server.httpServer?.once("close", () => agent.destroy());
    const identities = new WeakMap<IncomingMessage, Identity>();
    const htmlDir = resolve(server.config.root, "../docker/nginx/root/usr/share/nginx/html");
    const loggedIn = readFileSync(resolve(htmlDir, "loggedin.html"));
    const loggedOut = readFileSync(resolve(htmlDir, "loggedout.html"));

    const apiProxy = server.config.server.proxy?.["/api/v1"];
    if (!apiProxy || typeof apiProxy === "string") {
      throw new Error("Shared auth requires the /api/v1 Vite proxy configuration.");
    }
    const configureProxy = apiProxy.configure;
    apiProxy.configure = (proxy, proxyOptions: ProxyOptions) => {
      configureProxy?.(proxy, proxyOptions);
      const setIdentity = (outgoing: ClientRequest, req: IncomingMessage): void => {
        for (const name of outgoing.getHeaderNames()) {
          if (isIdentityHeader(name)) outgoing.removeHeader(name);
        }
        const identity = identities.get(req);
        if (identity) {
          // The current JWT decoder looks for this exact spelling in rawHeaders.
          outgoing.setHeader("X-Access-Token", identity.token);
          if (identity.user) outgoing.setHeader("X-User", identity.user);
          if (identity.email) outgoing.setHeader("X-Email", identity.email);
        }
        outgoing.setHeader("X-Real-IP", req.socket.remoteAddress || "");
      };
      proxy.on("proxyReq", setIdentity);
      proxy.on("proxyRes", (upstream, req) => {
        const cookies = identities.get(req)?.cookies;
        if (cookies)
          upstream.headers["set-cookie"] = [...(upstream.headers["set-cookie"] || []), ...cookies];
      });
      // Coda's Socket.IO location is public in nginx; never forward a client-supplied JWT.
      proxy.on("proxyReqWs", setIdentity);
    };

    const requestAuth = (path: string, req: IncomingMessage): Promise<AuthResponse> =>
      new Promise((resolveResponse, reject) => {
        const request = authOrigin.protocol === "https:" ? httpsRequest : httpRequest;
        const outgoing = request(
          new URL(path, authOrigin),
          {
            method: "GET",
            agent: authOrigin.protocol === "https:" ? agent : undefined,
            headers: {
              Cookie: req.headers.cookie || "",
              "X-Real-IP": req.socket.remoteAddress || "",
              "X-Scheme": "https",
              "X-Forwarded-Proto": "https",
              "X-Auth-Request-Redirect": publicOrigin + req.url,
            },
          },
          (response) => {
            const chunks: Buffer[] = [];
            let size = 0;
            response.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > 1024 * 1024) {
                outgoing.destroy(new Error("Shared auth response exceeded the size limit"));
                return;
              }
              chunks.push(chunk);
            });
            response.on("error", reject);
            response.on("end", () =>
              resolveResponse({
                status: response.statusCode || 502,
                headers: response.headers,
                body: Buffer.concat(chunks),
              })
            );
          }
        );
        outgoing.on("error", reject);
        outgoing.setTimeout(options.timeoutMs || 10000, () =>
          outgoing.destroy(new Error("Shared auth request timed out"))
        );
        outgoing.end();
      });

    const copyCookies = (auth: AuthResponse, res: ServerResponse): void => {
      const cookies = auth.headers["set-cookie"];
      if (cookies) res.setHeader("Set-Cookie", cookies);
    };
    const redirectToLogin = (req: IncomingMessage, res: ServerResponse): void => {
      res.writeHead(302, {
        Location: `/oauth2/sign_in?rd=${encodeURIComponent(publicOrigin + req.url)}`,
        "Cache-Control": "no-store",
      });
      res.end();
    };
    const sendHtml = (res: ServerResponse, html: Buffer, status = 200): void => {
      res.writeHead(status, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(html);
    };

    server.middlewares.use((req, res, next) => {
      for (const name of Object.keys(req.headers)) {
        if (isIdentityHeader(name)) delete req.headers[name];
      }
      const pathname = new URL(req.url || "/", publicOrigin).pathname;
      const oauthRoute = pathname.startsWith("/oauth2/");
      const login = pathname === "/login";
      const loginCheck = pathname === "/is-logged-in";
      const logout = pathname === "/logout";
      if (pathname === "/loggedout") {
        sendHtml(res, loggedOut, 401);
        return;
      }
      const document =
        !pathname.startsWith("/api/") &&
        (req.method === "GET" || req.method === "HEAD") &&
        (pathname === "/" ||
          pathname === "/index.html" ||
          req.headers.accept?.includes("text/html"));
      if (!oauthRoute && !login && !loginCheck && !logout && !document && !protectedApi(pathname)) {
        next();
        return;
      }

      const handle = async (): Promise<void> => {
        if (oauthRoute || logout) {
          if (req.method !== "GET" && req.method !== "HEAD") {
            res.writeHead(405, { Allow: "GET, HEAD" });
            res.end();
            return;
          }
          const auth = await requestAuth(logout ? "/oauth2/sign_out" : req.url || pathname, req);
          if (auth.status >= 500) throw new Error("Shared auth is unavailable");
          copyCookies(auth, res);
          if (logout) {
            sendHtml(res, loggedOut);
            return;
          }
          for (const [name, value] of Object.entries(auth.headers)) {
            if (
              value !== undefined &&
              !["connection", "keep-alive", "transfer-encoding", "set-cookie"].includes(name) &&
              !isIdentityHeader(name)
            ) {
              res.setHeader(name, value);
            }
          }
          res.setHeader("Cache-Control", "no-store");
          res.statusCode = auth.status;
          res.end(auth.body);
          return;
        }

        const auth = await requestAuth("/oauth2/auth", req);
        copyCookies(auth, res);
        if (auth.status === 401) {
          if (loginCheck) sendHtml(res, loggedOut, 401);
          else redirectToLogin(req, res);
          return;
        }
        if (auth.status === 403) {
          res.writeHead(403);
          res.end("Access denied by shared authentication.");
          return;
        }
        const token = auth.headers["x-auth-request-access-token"];
        if (auth.status < 200 || auth.status >= 300 || typeof token !== "string" || !token) {
          throw new Error("Shared auth did not supply a validated access token");
        }
        if (login || loginCheck) {
          sendHtml(res, loggedIn);
          return;
        }
        identities.set(req, {
          token,
          user: auth.headers["x-auth-request-user"] as string | undefined,
          email: auth.headers["x-auth-request-email"] as string | undefined,
          cookies: auth.headers["set-cookie"],
        });
        res.setHeader("Cache-Control", "no-store");
        next();
      };
      void handle().catch(() => {
        if (res.writableEnded || res.destroyed) return;
        res.writeHead(502, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
        res.end("Shared authentication is unavailable. Please retry.");
      });
    });
  },
});
