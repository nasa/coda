import cacache from "cacache";
import fetchWithCache from "./cache-client";
import { CacheFolder } from "utils/enums";

/** Pause the main thread for `seconds` seconds */
async function waitFor(seconds: number) {
  return await (async () => {
    return new Promise((resolve) => {
      setTimeout(resolve, seconds * 1000);
    });
  })();
}

describe("services/cache-client", () => {
  let warn;

  it("forcedNew should return inprogress", async () => {
    const identifier = `${expect.getState().currentTestName} test1`;

    const data = { message: "executed" };
    const retriever = async () => {
      return data;
    };

    const res = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
      cacheAge: 1,
      forceRetriever: true,
    });
    expect(res.responseMetadata.retrieverStatus).toEqual("inprogress");
  });

  it("should return a 'complete' response when cache is populated and data is not expired", async () => {
    const identifier = `${expect.getState().currentTestName} test2`;
    let runs = 0;
    const retriever = async () => {
      runs += 1;
      return {};
    };

    // force a new run
    await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
      cacheAge: 100,
      forceRetriever: true,
      randomizeCacheAge: false,
    });

    // wait
    await waitFor(0.25);

    // run again but this time we should get a "complete" response
    const res = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
    });

    expect(res.responseMetadata.retrieverStatus).toEqual("complete");
    // retriever should only have run once
    expect(runs).toEqual(1);
  });

  it("should return cached data when the cache is expired with a 'inprogress' response", async () => {
    const identifier = `${expect.getState().currentTestName} test3`;

    let runs = 0;
    const retriever = async () => {
      // long running retriever
      await waitFor(0.25);
      runs++;
      return { runs };
    };

    const res1 = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
      cacheAge: 100,
      forceRetriever: true,
      randomizeCacheAge: false,
    });
    expect(res1.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res1.data).toBeNull();
    expect(runs).toBe(0);

    // run again and we should still get an "inprogress" response
    const res2 = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
    });
    expect(res2.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res2.data).toBeNull();
    expect(runs).toBe(0);
  });

  it("should give sane responses throughout lifecycle", async () => {
    const identifier = `${expect.getState().currentTestName} test4`;
    const cacheAge = 0.1;

    let runs = 0;
    const retriever = async () => {
      await waitFor(cacheAge / 10);
      runs++;
      return { runs };
    };

    const res1 = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
      cacheAge,
      forceRetriever: true,
      randomizeCacheAge: false,
    });
    expect(res1.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res1.data).toBeNull();
    expect(runs).toBe(0);

    // run again and we should still get an "inprogress" response
    const res2 = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
    });
    expect(res2.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res2.data).toBeNull();
    expect(runs).toBe(0);

    await waitFor(cacheAge);
    expect(runs).toBe(1);

    // cache should definitely be expired
    const res3 = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
      cacheAge,
    });
    expect(res3.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res3.data.runs).toBe(1);
    expect(runs).toBe(1);

    // wait long enough for the retriever to run a second time, but not so long the cache is expired
    await waitFor(cacheAge / 2);

    const res4 = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
    });
    expect(res4.responseMetadata.retrieverStatus).toEqual("complete");
    expect(res4.data.runs).toBe(2);
    expect(runs).toBe(2);
  });

  it("should log and recover from errors", async () => {
    const identifier = `${expect.getState().currentTestName} test5`;

    let runs = 0;
    const retriever = async () => {
      runs++;
      throw new Error("aliens took out our antenna");
    };

    const res1 = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
      cacheAge: 1,
      // we will cooldown 0.05 seconds (or 50ms) x errorCount after each failed retriever
      errorRetryCoefficient: 0.05,
    });
    expect(res1.responseMetadata.retrieverStatus).toEqual("inprogress");

    // wait 0.1 seconds < errorRetryCoefficient * errorCount, so we should be within the initial cooldown period after the first error
    await waitFor(0.01);
    expect(runs).toBe(1);

    // we haven't waited long enough. we should see that the last run of the retriever was an error
    const res2 = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
      cacheAge: 1,
      errorRetryCoefficient: 0.05,
    });
    expect(res2.responseMetadata.retrieverStatus).toEqual("error");
    expect(res2.responseMetadata.errorCount).toBe(1);

    await waitFor(0.05);

    // we didn't wait long enough to run the retriever a second time
    expect(runs).toBe(1);

    // we've waited more than `errorRetryCoefficient x errorCount` time after the last error. the retriever should run again
    const res3 = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
      cacheAge: 1,
      errorRetryCoefficient: 0.05,
    });
    // even though last time was an error, it's retrying the retriever, hence 'inprogress'
    expect(res3.responseMetadata.retrieverStatus).toEqual("inprogress");
    // bc we run the retriever async, it doesn't know this attempt will also result in an error
    expect(res3.responseMetadata.errorCount).toBe(1);

    // internally, the errorCount is 2. we need to wait at least 2 x errorRetryCoefficient = 0.1 seconds after the last error to retry the retriever
    await waitFor(0.1);

    // we should see the retriever ran again last time after we waited long enough
    expect(runs).toBe(2);

    // now we'll recover
    const goodStatusMessage = "aliens put the antenna back";

    const res4 = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever: async () => {
        runs++;
        return { statusMessage: goodStatusMessage };
      },
      cacheAge: 1,
      errorRetryCoefficient: 0.05,
    });
    expect(res4.responseMetadata.retrieverStatus).toEqual("inprogress");
    // last time we ran, we saw a second error
    expect(res4.responseMetadata.errorCount).toBe(2);

    await waitFor(0.01);

    // back to good responses. we should see the cached response from last time
    const res5 = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever: async () => {
        runs++;
        return { statusMessage: "some other status message we should never see" };
      },
      cacheAge: 1,
      errorRetryCoefficient: 0.05,
    });
    expect(res5.responseMetadata.retrieverStatus).toEqual("complete");
    expect(res5.responseMetadata.errorCount).toBe(0);
    expect(res5.data.statusMessage).toBe(goodStatusMessage);

    await waitFor(0.01);

    // the retriever erred twice then succeeded
    expect(runs).toBe(3);
  });

  beforeAll(() => {
    // testing retrievers that throw will lead to a bunch of unnecessary console.warn'ing
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  // ensure we're starting with a clean cache and cleaning up after ourselves
  beforeEach(async () => {
    await cacache.rm.all(`${process.env.CACHE_ROOT}/${CacheFolder.test}`);
  });
  afterAll(async () => {
    // await cacache.rm.all(`${process.env.CACHE_ROOT}/${CacheFolder.test}`);
    warn.mockReset();
  });
});
