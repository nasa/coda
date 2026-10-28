import { fetchTalkybotTranscript, getTalkybotSetupError } from "./talkybot";

const baseUrl = "https://talkybot.fit.nasa.gov";

beforeEach(() => {
  vi.stubEnv("VITE_PUBLIC_TALKYBOT_URL", baseUrl);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Talkybot session requests", () => {
  it("loads both simulation buckets with credentials and rejects login redirects", async () => {
    const nonSim = { uuid: "non-sim" };
    const sim = { uuid: "sim" };
    const fetchMock = vi.fn(async (url: string) =>
      Response.json({ audioFiles: url.endsWith("sim=true") ? [sim] : [nonSim] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    expect(await fetchTalkybotTranscript("2026-10-28", controller.signal)).toEqual([nonSim, sim]);
    for (const simValue of [false, true]) {
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/transcript/2026-10-28?sim=${simValue}`,
        { credentials: "include", redirect: "error", signal: controller.signal }
      );
    }
  });

  it("keeps a successful empty date distinct from an authentication failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ audioFiles: [] }))
    );
    expect(await fetchTalkybotTranscript("2026-10-28")).toEqual([]);
  });

  it("rejects the whole load if either simulation bucket needs authentication", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("sim=true")
          ? new Response(null, { status: 401 })
          : Response.json({ audioFiles: [{ uuid: "public-file" }] })
      )
    );
    await expect(fetchTalkybotTranscript("2026-10-28")).rejects.toThrow("HTTP 401");
  });

  it("surfaces CORS or redirect failures so the panel can offer sign-in and retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(fetchTalkybotTranscript("2026-10-28")).rejects.toThrow("Failed to fetch");
  });

  it("does not report a login page or malformed response as an empty successful date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ email: "user@nasa.gov" }))
    );
    await expect(fetchTalkybotTranscript("2026-10-28")).rejects.toThrow("Invalid Talkybot");
  });

  it("does not send requests to CODA when Talkybot is unconfigured", async () => {
    vi.stubEnv("VITE_PUBLIC_TALKYBOT_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchTalkybotTranscript("2026-10-28")).rejects.toThrow("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("local Talkybot setup", () => {
  it("requires HTTPS for the local direct client", () => {
    expect(getTalkybotSetupError("http://coda-local.fit.nasa.gov:3000")).toContain("HTTPS");
    expect(getTalkybotSetupError("https://coda-local.fit.nasa.gov:3000")).toBeNull();
  });

  it("requires the shared-domain hostname instead of localhost", () => {
    expect(getTalkybotSetupError("https://localhost:3000")).toContain("coda-local.fit.nasa.gov");
    expect(getTalkybotSetupError("https://127.0.0.1:3000")).not.toBeNull();
  });

  it("allows deployed Coda and an explicitly configured HTTP mock server", () => {
    expect(getTalkybotSetupError("https://coda.fit.nasa.gov")).toBeNull();
    vi.stubEnv("VITE_PUBLIC_TALKYBOT_URL", "http://localhost:5001");
    expect(getTalkybotSetupError("http://localhost:3000")).toBeNull();
  });
});
