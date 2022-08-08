import fetchWithTimeout, { withFetch } from "utils/testfetch";
import fetch, { RequestInit } from "node-fetch";
import https from "https";
import AbortSignal from "abort-controller";

//turn the node-fetch module fetch call into jest mocked call
jest.mock("node-fetch");
//return acutal node-fetch response instead of the mocked version of the response
const { Response, RequestInit } = jest.requireActual("node-fetch");
const res = new Response(JSON.stringify({ testData: 100 }));
// (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(res);
setTimeout(
  (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(() => {
    // const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    // return wait(0).then(new Response(JSON.stringify({ testData: 100 })));

    return Promise.resolve(res);
  }),
  10000
);

describe("fetchWithTimeout", () => {
  it("fetch valid", async () => {
    const response = await fetchWithTimeout("url", { timeout: 1000 });
    const json = await response.json();

    //check mock response
    expect(json).toEqual({ testData: 100 });

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
    //check signal passed in
    expect(reqInit.signal).not.toBeNull();
    expect(reqInit.signal).not.toBeUndefined();
    //expect(reqInit.signal).toBeInstanceOf(AbortSignal);
  });

  //put the fetch call back to original call
  jest.unmock("node-fetch");
});
