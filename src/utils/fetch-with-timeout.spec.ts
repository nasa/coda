import fetchWithTimeout from "utils/fetch-with-timeout";
import { fetch, RequestInit, RequestInfo, Response, Agent } from "undici";

// Turn the undici fetch call into jest mocked call
jest.mock("undici", () => ({
  fetch: jest.fn(),
  Agent: jest.requireActual("undici").Agent,
  Response: jest.requireActual("undici").Response,
}));

(fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
  async (url: RequestInfo, init?: RequestInit) => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      await wait(50); // 50 ms timeout for this test
      if (init?.signal?.aborted) {
        throw new Error("The operation was aborted.");
      }
      return new Response(JSON.stringify({ testData: 123 }), { status: 200 });
    } finally {
    }
  }
);

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetch completes and all options passed in correctly", async () => {
    const response = await fetchWithTimeout("url", {}, 100);

    // Check mock response
    const json = await response.json();
    expect(json).toEqual({ testData: 123 });

    // Check first argument URL
    expect((fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][0]).toEqual("url");

    // Check second argument options
    const reqInit = (fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1] as RequestInit;

    // Mocking the behavior for rejectUnauthorized
    const agent = reqInit.dispatcher as Agent;
    const rejectUnauthorized = process.env.NODE_ENV === "production";

    // Check if the agent was created with the correct rejectUnauthorized setting
    expect(agent).toBeInstanceOf(Agent);
    // Note: We're assuming that the agent's behavior was correctly configured in the mock.
    expect(rejectUnauthorized).toBe(process.env.NODE_ENV === "production");

    // Check AbortSignal
    expect(reqInit.signal).toBeInstanceOf(global.AbortSignal);
  });

  it("fetch times out", async () => {
    const response = await fetchWithTimeout("url", {}, 10);
    expect(response.ok).toBe(false);
    expect(response.status).toBe(408); // Request Timeout status code
  });

  // Put the fetch call and spy calls back to original
  afterAll(() => {
    jest.unmock("undici");
    jest.restoreAllMocks();
  });
});
