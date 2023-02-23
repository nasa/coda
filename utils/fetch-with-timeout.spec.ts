import fetchWithTimeout from "utils/fetch-with-timeout";
import fetch, { RequestInit, RequestInfo } from "node-fetch";
import https from "https";
import { AbortSignal } from "abort-controller";

//turn the node-fetch module fetch call into jest mocked call
jest.mock("node-fetch");
//return acutal node-fetch response instead of the mocked version of the response
const { Response } = jest.requireActual("node-fetch");

(fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
  async (url: RequestInfo, init?: RequestInit) => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      await wait(50); //50 ms timeout for this test
      if (init.signal.aborted) return undefined;
      return new Response(JSON.stringify({ testData: 123 }));
    } finally {
    }
  }
);

describe("fetchWithTimeout", () => {
  it("fetch completes and all options passed in correctly", async () => {
    const response = await fetchWithTimeout("url", {}, 100);

    //check mock response
    const json = await response.json();
    expect(json).toEqual({ testData: 123 });

    //check first argument URL
    expect((fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][0]).toEqual("url");

    //check second argument options
    const reqInit = (fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1] as RequestInit;
    //check environment for unauthorized certs
    const rejUnauth = (reqInit.agent as https.Agent).options.rejectUnauthorized;
    if (process.env.NODE_ENV === "production") {
      expect(rejUnauth).toBe(true);
    } else {
      expect(rejUnauth).toBe(false);
    }
    //check AbortSignal
    expect(reqInit.signal).toBeInstanceOf(AbortSignal);
  });

  it("fetch times out", async () => {
    const response = await fetchWithTimeout("url", {}, 10);

    //check mock response
    expect(response).toBeUndefined();
  });

  //put the fetch call and spy calls back to original
  jest.unmock("node-fetch");
  jest.restoreAllMocks();
});
