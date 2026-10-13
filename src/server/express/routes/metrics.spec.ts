import { once } from "node:events";
import type { AddressInfo } from "node:net";

import express from "express";
import * as prometheus from "prom-client";

import metricsRoutes from "./metrics";

const app = express();
app.use("/api/v1/metrics", metricsRoutes);

const originalEmssToken = process.env.EMSS_TOKEN;

const getMetrics = async (apiKey?: string) => {
  const server = app.listen(0);
  await once(server, "listening");

  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/metrics`, {
      headers: apiKey ? { "X-API-Key": apiKey } : undefined,
    });

    return { response, body: await response.text() };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

beforeEach(() => {
  process.env.EMSS_TOKEN = "test-emss-token";
});

afterAll(() => {
  if (originalEmssToken === undefined) {
    delete process.env.EMSS_TOKEN;
  } else {
    process.env.EMSS_TOKEN = originalEmssToken;
  }
});

describe("Metrics API Endpoint", () => {
  test("Returns 401 when the API key is missing", async () => {
    const { response, body } = await getMetrics();

    expect(response.status).toBe(401);
    expect(JSON.parse(body)).toEqual({ error: "missing API key" });
  });

  test("Returns 500 when EMSS_TOKEN is not configured", async () => {
    delete process.env.EMSS_TOKEN;

    const { response, body } = await getMetrics("test-emss-token");

    expect(response.status).toBe(500);
    expect(JSON.parse(body)).toEqual({ error: "unable to verify API key" });
  });

  test("Returns 403 when the API key is invalid", async () => {
    const { response, body } = await getMetrics("invalid-token");

    expect(response.status).toBe(403);
    expect(JSON.parse(body)).toEqual({ error: "invalid API key" });
  });

  test("Returns Prometheus default metrics for a valid API key", async () => {
    const { response, body } = await getMetrics("test-emss-token");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(prometheus.register.contentType);
    expect(body).toContain("# HELP process_cpu_user_seconds_total");
  });
});
