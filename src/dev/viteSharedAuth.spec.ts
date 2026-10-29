import { createServer as createHttpServer } from "node:http";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import type { Request } from "express";
import { createServer as createViteServer } from "vite";
import type { ViteDevServer } from "vite";
import WebSocket, { WebSocketServer } from "ws";
import { getUserFromJWT } from "@emss/oauth2-proxy-backend";
import { sharedAuthPlugin } from "./viteSharedAuth";

const localOrigin = "https://coda-local.fit.nasa.gov:3000";
const token = [
  Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
  Buffer.from(JSON.stringify({ nasa_auid: "real-user", nasa_role: ["CODA-Superuser"] })).toString(
    "base64url"
  ),
  "test-signature",
].join(".");
const refreshCookies = [
  "EMSS_SESSION=refreshed; Path=/; Secure; HttpOnly",
  "EMSS_SESSION_1=second-part; Path=/; Secure; HttpOnly",
];

const address = (server: HttpServer): string =>
  `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const listen = async (server: HttpServer): Promise<void> => {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
};
const close = async (server: HttpServer): Promise<void> => {
  server.closeAllConnections();
  await new Promise<void>((done) => server.close(() => done()));
};

describe("Vite shared-auth gateway", () => {
  let auth: HttpServer;
  let api: HttpServer;
  let vite: ViteDevServer;
  let websocketServer: WebSocketServer;
  let baseUrl: string;
  let authStatus = 202;
  let supplyToken = true;
  let apiCalls = 0;
  let authCalls: { path: string; cookie: string; token?: string; redirect?: string }[];
  let apiCookie: string | undefined;

  beforeAll(async () => {
    auth = createHttpServer((req, res) => {
      authCalls.push({
        path: req.url || "",
        cookie: req.headers.cookie || "",
        token: req.headers["x-access-token"] as string | undefined,
        redirect: req.headers["x-auth-request-redirect"] as string | undefined,
      });
      const authenticated = req.headers.cookie?.includes("EMSS_SESSION=valid");
      if (req.url === "/oauth2/auth") {
        res.setHeader("Set-Cookie", refreshCookies);
        if (authStatus === 202 && authenticated) {
          if (supplyToken) res.setHeader("X-Auth-Request-Access-Token", token);
          res.setHeader("X-Auth-Request-User", "real-user");
          res.setHeader("X-Auth-Request-Email", "real-user@nasa.gov");
          res.writeHead(202);
        } else res.writeHead(authStatus === 202 ? 401 : authStatus);
        res.end();
      } else if (req.url === "/oauth2/userinfo") {
        res.setHeader("Content-Type", "application/json");
        res.writeHead(authenticated ? 200 : 401);
        res.end(JSON.stringify(authenticated ? { email: "real-user@nasa.gov" } : {}));
      } else if (req.url === "/oauth2/sign_out") {
        res.setHeader("Set-Cookie", "EMSS_SESSION=; Max-Age=0; Path=/");
        res.writeHead(302, { Location: "/" });
        res.end();
      } else {
        res.setHeader("Set-Cookie", "EMSS_SESSION_csrf=test-only; Path=/");
        res.writeHead(302, { Location: "https://login.example/authorize" });
        res.end();
      }
    });
    api = createHttpServer(async (req: IncomingMessage, res) => {
      apiCalls += 1;
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const user = getUserFromJWT(req as Request);
      if (apiCookie) res.setHeader("Set-Cookie", apiCookie);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          auid: user instanceof Error ? null : user.auid,
          token: req.headers["x-access-token"] || null,
          email: req.headers["x-email"] || null,
          authorization: req.headers.authorization || null,
          body: Buffer.concat(chunks).toString(),
        })
      );
    });
    websocketServer = new WebSocketServer({ noServer: true });
    api.on("upgrade", (req, socket, head) => {
      websocketServer.handleUpgrade(req, socket, head, (client) => {
        client.send(JSON.stringify({ token: req.headers["x-access-token"] || null }));
      });
    });
    await listen(auth);
    await listen(api);
    vite = await createViteServer({
      configFile: false,
      envFile: false,
      root: resolve(process.cwd(), "src"),
      mode: "development",
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true, include: [] },
      plugins: [
        sharedAuthPlugin({ authOrigin: address(auth), publicOrigin: localOrigin, timeoutMs: 1000 }),
      ],
      server: {
        host: "127.0.0.1",
        port: 0,
        proxy: { "/api/v1": { target: address(api), changeOrigin: true, ws: true } },
        watch: { ignored: ["**/*"] },
      },
    });
    await vite.listen();
    baseUrl = address(vite.httpServer as HttpServer);
  });

  beforeEach(() => {
    authStatus = 202;
    supplyToken = true;
    apiCalls = 0;
    authCalls = [];
    apiCookie = undefined;
  });

  afterAll(async () => {
    await vite?.close();
    await close(auth);
    await close(api);
    websocketServer.close();
  });

  it("gets a real decoded identity from the auth response and replaces spoofed headers", async () => {
    const response = await fetch(`${baseUrl}/api/v1/user/current`, {
      headers: {
        Cookie: "EMSS_SESSION=valid; EMSS_SESSION_1=part",
        "X-Access-Token": "spoofed",
        "X-Email": "spoofed@example.org",
        Authorization: "Bearer spoofed",
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      auid: "real-user",
      token,
      email: "real-user@nasa.gov",
      authorization: null,
    });
    expect(authCalls).toEqual([
      {
        path: "/oauth2/auth",
        cookie: "EMSS_SESSION=valid; EMSS_SESSION_1=part",
        token: undefined,
        redirect: `${localOrigin}/api/v1/user/current`,
      },
    ]);
    expect(response.headers.get("x-access-token")).toBeNull();
  });

  it("preserves both refreshed session cookie chunks", async () => {
    const response = await fetch(`${baseUrl}/api/v1/user/current`, {
      headers: { Cookie: "EMSS_SESSION=valid" },
    });
    expect(response.headers.getSetCookie()).toEqual(refreshCookies);
    await response.text();
  });

  it("preserves backend cookies alongside session refresh cookies", async () => {
    apiCookie = "preference=example; Path=/";
    const response = await fetch(`${baseUrl}/api/v1/db/accessGrants`, {
      headers: { Cookie: "EMSS_SESSION=valid" },
    });
    expect(response.headers.getSetCookie()).toEqual([apiCookie, ...refreshCookies]);
    await response.text();
  });

  it("authenticates a POST without consuming or altering its body", async () => {
    const body = JSON.stringify({ name: "Restricted test", auids: ["real-user"] });
    const response = await fetch(`${baseUrl}/api/v1/db/accessGrants`, {
      method: "POST",
      headers: { Cookie: "EMSS_SESSION=valid", "Content-Type": "application/json" },
      body,
    });
    expect((await response.json()).body).toBe(body);
    expect(apiCalls).toBe(1);
  });

  it("redirects unauthenticated protected requests while preserving the complete return URL", async () => {
    const path = "/api/v1/restricted/videos?source=ARTEMIS&date=2026-10-28";
    const response = await fetch(baseUrl + path, { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `/oauth2/sign_in?rd=${encodeURIComponent(localOrigin + path)}`
    );
    expect(apiCalls).toBe(0);
    await response.text();
  });

  it("protects document navigation while leaving hot-reload modules available", async () => {
    const page = await fetch(`${baseUrl}/?date=2026-10-28&s=0`, { redirect: "manual" });
    expect(page.status).toBe(302);
    await page.text();
    authCalls = [];
    const hmr = await fetch(`${baseUrl}/@vite/client`);
    expect(hmr.status).toBe(200);
    expect(authCalls).toEqual([]);
    await hmr.text();
  });

  it.each([
    "/api/v1/health",
    "/api/v1/external/comm-overrides",
    "/api/v1/db/ephemeris/recent",
    "/api/v1/socketio?EIO=4&transport=polling",
  ])("leaves the public endpoint %s available without forwarding a supplied JWT", async (path) => {
    const response = await fetch(baseUrl + path, { headers: { "X-Access-Token": "spoofed" } });
    expect((await response.json()).token).toBeNull();
    expect(authCalls).toEqual([]);
  });

  it("provides the login page and same-origin userinfo used by the popup helper", async () => {
    const headers = { Cookie: "EMSS_SESSION=valid" };
    const login = await fetch(`${baseUrl}/login`, { headers });
    expect(await login.text()).toContain("You are logged in");
    const userinfo = await fetch(`${baseUrl}/oauth2/userinfo`, { headers });
    expect(await userinfo.json()).toEqual({ email: "real-user@nasa.gov" });
  });

  it("keeps Coda's websocket proxy working without forwarding browser identity headers", async () => {
    const client = new WebSocket(`${baseUrl.replace("http:", "ws:")}/api/v1/socketio`, {
      headers: { "X-Access-Token": "spoofed" },
    });
    try {
      const message = await new Promise<string>((done, reject) => {
        client.once("message", (data) => done(data.toString()));
        client.once("error", reject);
      });
      expect(JSON.parse(message)).toEqual({ token: null });
      expect(authCalls).toEqual([]);
    } finally {
      await new Promise<void>((done) => {
        client.once("close", () => done());
        client.close();
      });
    }
  });

  it("relays the sign-in redirect and CSRF cookie to the browser", async () => {
    const path = `/oauth2/sign_in?rd=${encodeURIComponent(`${localOrigin}/login`)}`;
    const response = await fetch(baseUrl + path, { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://login.example/authorize");
    expect(response.headers.getSetCookie()).toEqual(["EMSS_SESSION_csrf=test-only; Path=/"]);
    expect(authCalls[0].path).toBe(path);
    await response.text();
  });

  it("clears the shared cookie and serves the logged-out page", async () => {
    const response = await fetch(`${baseUrl}/logout`);
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual(["EMSS_SESSION=; Max-Age=0; Path=/"]);
    expect(await response.text()).toContain("logged");
  });

  it("returns a failed login check without redirecting to LaunchPad", async () => {
    const response = await fetch(`${baseUrl}/is-logged-in`, { redirect: "manual" });
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    await response.text();
  });

  it.each([403, 503])(
    "does not contact the API when the auth service returns %s",
    async (status) => {
      authStatus = status;
      const response = await fetch(`${baseUrl}/api/v1/user/current`, {
        headers: { Cookie: "EMSS_SESSION=valid" },
        redirect: "manual",
      });
      expect(response.status).toBe(status === 403 ? 403 : 502);
      expect(apiCalls).toBe(0);
      await response.text();
    }
  );

  it("requires the access token even if the auth service returns success", async () => {
    supplyToken = false;
    const response = await fetch(`${baseUrl}/api/v1/user/current`, {
      headers: { Cookie: "EMSS_SESSION=valid" },
    });
    expect(response.status).toBe(502);
    expect(apiCalls).toBe(0);
    await response.text();
  });
});
