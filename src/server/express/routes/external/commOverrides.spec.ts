import { vi } from "vitest";
import type { Mock } from "vitest";
import type { Request, Response } from "express";
import getCommOverrides from "server/processing/commOverrides";
import router from "./commOverrides";

vi.mock("server/processing/commOverrides");

const getCommOverridesMock = getCommOverrides as Mock;

/**
 * Pulls the GET "/" handler out of the router so it can be invoked directly with
 * mock req/res objects, without needing an HTTP server or supertest.
 */
function getRouteHandler(): (req: Request, res: Response) => Promise<void> {
  const layer = (
    router as unknown as {
      stack: Array<{
        route?: {
          path: string;
          methods: Record<string, boolean>;
          stack: Array<{ handle: unknown }>;
        };
      }>;
    }
  ).stack.find((l) => l.route?.path === "/" && l.route.methods.get);
  if (!layer?.route) {
    throw new Error("GET / route not found on commOverrides router");
  }
  return layer.route.stack[0].handle as (req: Request, res: Response) => Promise<void>;
}

function buildRes() {
  const res: { status: Mock; json: Mock } = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & { status: Mock; json: Mock };
}

function buildReq(query: Record<string, string | undefined>): Request {
  return { query } as unknown as Request;
}

describe("commOverrides route", () => {
  const handler = getRouteHandler();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("source allowlist", () => {
    it("should reject a missing source", async () => {
      const res = buildRes();
      await handler(buildReq({ date: "2025-01-15" }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error", message: "Invalid or missing source" })
      );
      expect(getCommOverridesMock).not.toHaveBeenCalled();
    });

    it("should reject a source that doesn't support talkybot (e.g. NBL)", async () => {
      const res = buildRes();
      await handler(buildReq({ source: "NBL", date: "2025-01-15" }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error", message: "Invalid or missing source" })
      );
      expect(getCommOverridesMock).not.toHaveBeenCalled();
    });

    it("should reject an unrecognized source string", async () => {
      const res = buildRes();
      await handler(buildReq({ source: "NOT_A_SOURCE", date: "2025-01-15" }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(getCommOverridesMock).not.toHaveBeenCalled();
    });

    it.each(["ISS", "TEST_EVENTS", "ARTEMIS"])(
      "should accept the talkybot-enabled source %s",
      async (source) => {
        getCommOverridesMock.mockResolvedValue({
          data: [],
          fetchMetadata: { success: true, timestamp: "2025-01-15T00:00:00.000Z" },
          origin: "override",
        });
        const res = buildRes();
        await handler(buildReq({ source, date: "2025-01-15" }), res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(getCommOverridesMock).toHaveBeenCalledWith({ source, dateWanted: "2025-01-15" });
      }
    );
  });

  describe("date validation", () => {
    it("should reject a missing date", async () => {
      const res = buildRes();
      await handler(buildReq({ source: "ISS" }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "error",
          message: "Invalid or missing date (expected YYYY-MM-DD)",
        })
      );
      expect(getCommOverridesMock).not.toHaveBeenCalled();
    });

    it.each([
      "01-15-2025",
      "2025/01/15",
      "2025-13-01",
      "2025-01-32",
      "2025-02-29",
      "2026-02-30",
      "not-a-date",
      "2025-1-1",
    ])("should reject malformed date %s", async (date) => {
      const res = buildRes();
      await handler(buildReq({ source: "ISS", date }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(getCommOverridesMock).not.toHaveBeenCalled();
    });

    it("should accept a well-formed YYYY-MM-DD date", async () => {
      getCommOverridesMock.mockResolvedValue({
        data: [],
        fetchMetadata: { success: true, timestamp: "2025-01-15T00:00:00.000Z" },
        origin: "override",
      });
      const res = buildRes();
      await handler(buildReq({ source: "ISS", date: "2025-01-15" }), res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(getCommOverridesMock).toHaveBeenCalledWith({
        source: "ISS",
        dateWanted: "2025-01-15",
      });
    });
  });

  describe("error handling", () => {
    it("should return 500 when getCommOverrides throws", async () => {
      getCommOverridesMock.mockRejectedValue(new Error("boom"));
      const res = buildRes();
      await handler(buildReq({ source: "ISS", date: "2025-01-15" }), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
    });
  });
});
