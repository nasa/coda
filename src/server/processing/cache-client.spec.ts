import cacache from "cacache";
import fetchWithCache, { clearCacheByFolder } from "./cache-client";

/** Pause the main thread for `seconds` seconds */
async function waitFor(seconds: number) {
  return await (async () => {
    return new Promise((resolve) => {
      setTimeout(resolve, seconds * 1000);
    });
  })();
}

describe("services/cache-client", () => {
  let warnMock, errorMock;

  beforeAll(async () => {
    // testing retrievers that throw will lead to a bunch of unnecessary console.warn'ing and console.error'ing
    errorMock = jest.spyOn(console, "error").mockImplementation(() => {});
    warnMock = jest.spyOn(console, "warn").mockImplementation(() => {});
    await clearCacheByFolder("test");
  });

  afterAll(async () => {
    errorMock.mockReset();
    warnMock.mockReset();
    await clearCacheByFolder("test");
  });

  it("new calls should return inprogress", async () => {
    const identifier = `${expect.getState().currentTestName} test1`;

    const data = { message: "executed" };
    const retriever = async () => {
      await waitFor(0.1);
      return data;
    };

    const res = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge: 1,
    });
    expect(res.responseMetadata.retrieverStatus).toEqual("inprogress");
  });

  it("should return a 'complete' response when cache is populated and data is not expired", async () => {
    const identifier = `${expect.getState().currentTestName} test2`;
    const data = "son of Dr. Soong";
    const retriever = jest.fn(async () => {
      return { data };
    });

    const res1 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge: 100,
      forceRetriever: true,
      randomizeCacheAge: false,
    });

    // nothing in the cache so the retriever is running async
    expect(res1.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res1.data).toBeNull();
    // you would think the next line would be true, but we have no control over when the retriever runs. it may have run between the return from `await fetchWithCache` and here
    // expect(retriever).not.toHaveBeenCalled();

    await waitFor(0.25);

    const res2 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
    });

    expect(res2.responseMetadata.retrieverStatus).toEqual("complete");
    expect(res2.data.data).toEqual(data);
    expect(retriever).toHaveBeenCalledTimes(1);
  });

  it("should continue to respond 'inprogress' until the retriever completes", async () => {
    const identifier = `${expect.getState().currentTestName} test3`;

    const data = "brother of Lore";
    let runs = 0;
    const retriever = jest.fn(async () => {
      // long running retriever
      await waitFor(0.25);
      runs++;
      return { data };
    });

    const res1 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge: 100,
      forceRetriever: true,
      randomizeCacheAge: false,
    });
    expect(res1.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res1.data).toBeNull();
    // check runs because incrementing them occurs at the end of the retriever. if we just check whether the retriever has been called, it likely has been called by now - it just may not have completed due to the wait
    expect(runs).toBe(0);

    // not enough time has passed for the retriever
    const res2 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
    });
    expect(res2.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res2.data).toBeNull();
    expect(runs).toBe(0);

    // allow enough time to elapse to get a "complete" response
    await waitFor(0.5);

    const res3 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
    });
    expect(res3.responseMetadata.retrieverStatus).toEqual("complete");
    expect(res3.data.data).toEqual(data);

    // despite 3 calls to `fetchWithCache`, the retriever should only run once
    expect(retriever).toHaveBeenCalledTimes(1);
  });

  it("should give sane responses throughout lifecycle", async () => {
    const identifier = `${expect.getState().currentTestName} test4`;
    const cacheAge = 0.1;

    const data = "Lieutenant Commander";
    const retriever = jest.fn(async () => {
      await waitFor(cacheAge / 10);
      return { data };
    });

    const res1 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge,
      forceRetriever: true,
      randomizeCacheAge: false,
    });
    expect(res1.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res1.data).toBeNull();

    // run again and we should still get an "inprogress" response
    const res2 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge,
    });
    expect(res2.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res2.data).toBeNull();

    await waitFor(cacheAge * 2); // give it some extra time to avoid race condition

    // cache should definitely be expired
    const res3 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge,
    });
    expect(res3.responseMetadata.retrieverStatus).toEqual("inprogress");

    // wait long enough for the retriever to run a second time, but not so long the cache is expired
    await waitFor(cacheAge / 2);

    const res4 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge,
    });
    expect(res4.responseMetadata.retrieverStatus).toEqual("complete");
    expect(res4.data.data).toBe(data);
    expect(retriever).toHaveBeenCalledTimes(2);
  });

  it("should log and recover from errors", async () => {
    const identifier = `${expect.getState().currentTestName} test5`;
    const retryCoefficient = 1;
    let shouldError = true;

    let retriever = jest.fn(async () => {
      if (shouldError) {
        throw new Error("aliens took out our antenna");
      }
      return {};
    });

    const res1 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge: 1,
      // we will cooldown retryCoefficient x errorCount after each failed retriever
      errorRetryCoefficient: retryCoefficient,
    });

    //expect the immediate inprogress response
    expect(res1.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res1.responseMetadata.retrieverErrorCount).toBe(0);

    // we haven't waited long enough. we should see that the last run of the retriever was an error
    await waitFor(retryCoefficient / 2);
    const res2 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge: 1,
      errorRetryCoefficient: retryCoefficient,
    });
    expect(res2.responseMetadata.retrieverStatus).toEqual("error");
    expect(res2.responseMetadata.retrieverErrorCount).toBe(1);
    expect(retriever).toHaveBeenCalledTimes(1);

    await waitFor(retryCoefficient);
    // we've waited more than `errorRetryCoefficient x errorCount` time after the last error. the retriever should run again
    const res3 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge: 1,
      errorRetryCoefficient: retryCoefficient,
    });
    // even though last time was an error, it's retrying the retriever, hence 'inprogress'
    expect(res3.responseMetadata.retrieverStatus).toEqual("inprogress");
    // bc we run the retriever async, it doesn't know this attempt will also result in an error
    expect(res3.responseMetadata.retrieverErrorCount).toBe(1);
    expect(retriever).toHaveBeenCalledTimes(2);

    // internally, the errorCount is 2. we need to wait at least 2 x errorRetryCoefficient = 0.1 seconds after the last error to retry the retriever
    await waitFor(retryCoefficient * 2);
    // now we'll recover
    shouldError = false;
    const res4 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge: 1,
      errorRetryCoefficient: retryCoefficient,
    });
    expect(res4.responseMetadata.retrieverStatus).toEqual("inprogress");
    // last time we ran, we saw a second error
    expect(res4.responseMetadata.retrieverErrorCount).toBe(2);
    expect(retriever).toHaveBeenCalledTimes(3);

    await waitFor(0.1);
    // back to good responses. we should see the cached response from last time
    const res5 = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
      cacheAge: 1,
      errorRetryCoefficient: retryCoefficient,
    });
    expect(res5.responseMetadata.retrieverStatus).toEqual("complete");
    expect(res5.responseMetadata.retrieverErrorCount).toBe(0);
    // the retriever erred twice then succeeded
    expect(retriever).toHaveBeenCalledTimes(3);
  });

  it("should err gracefully when cacache experiences read errors", async () => {
    // simulate an error like the cache's disk isn't found. the cache client won't bother running the retriever if it doesn't think it can access the filesystem
    const cacacheGetInfoMock = jest.spyOn(cacache.get, "info").mockImplementation(async () => {
      throw new Error("something went wrong reading from the filesystem");
    });

    const identifier = `${expect.getState().currentTestName} test6`;
    const data = "Brent Spiner";
    let runs = 0;
    const retriever = async () => {
      runs += 1;
      return data;
    };

    const res = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
    });

    expect(res.responseMetadata.retrieverStatus).toEqual("complete");

    // cache client should always run the retriever when the cache is unavailable
    expect(res.data).toEqual(data);
    expect(runs).toEqual(1);

    expect(cacacheGetInfoMock).toHaveBeenCalled();

    cacacheGetInfoMock.mockReset();
  });

  it("should err gracefully when cacache experiences write errors", async () => {
    // simulate an error like the cache's disk isn't found. the cache client won't bother running the retriever if it doesn't think it can access the filesystem
    const cacachePutMock = jest.spyOn(cacache, "put").mockImplementation(async () => {
      throw new Error("something went wrong writing to the filesystem");
    });

    const identifier = `${expect.getState().currentTestName} test7`;
    const data = "Brent Spiner";
    let runs = 0;
    const retriever = async () => {
      runs += 1;
      return data;
    };

    const res = await fetchWithCache({
      identifier,
      cacheFolder: "test",
      retriever,
    });

    expect(res.responseMetadata.retrieverStatus).toEqual("complete");

    // cache client should always run the retriever when the cache is unavailable
    expect(res.data).toEqual(data);
    expect(runs).toEqual(1);

    expect(cacachePutMock).toHaveBeenCalled();

    cacachePutMock.mockReset();
  });
});
