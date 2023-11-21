import cacache from "cacache";
import fetchWithCache, { goRetrieve } from "./cache-client";
import { CacheFolder } from "utils/enums";

describe("services/cache-client", () => {
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

    // fetch and block until the retriever runs
    await (async () => {
      return new Promise((resolve) => {
        const handleRetriever = async <T>(
          cachePath: string,
          cacheKey: string,
          identifier: string,
          cachedData: Buffer,
          caCacheMetadata: CaCacheMetadata,
          retriever: () => Promise<T>,
          expiration: Date,
        ) => {
          await goRetrieve(
            cachePath,
            cacheKey,
            identifier,
            cachedData,
            caCacheMetadata,
            retriever,
            expiration,
          );
          resolve(null);
        };

        // force a new run
        fetchWithCache(
          {
            identifier,
            cacheFolder: CacheFolder.test,
            retriever,
            cacheAge: 100,
            forceRetriever: true,
            randomizeCacheAge: false,
          },
          handleRetriever,
        );
      });
    })();

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

    const retriever = async () => {
      // long running retriever
      await (async () => {
        return new Promise((resolve) => {
          setTimeout(resolve, 250);
        });
      })();
      return { ran: true };
    };

    // force a new run with a short expiration
    await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
      cacheAge: 100,
      forceRetriever: true,
      randomizeCacheAge: false,
    });

    // run again but this time we should get a "inprogress" response
    const res = await fetchWithCache({
      identifier,
      cacheFolder: CacheFolder.test,
      retriever,
    });
    expect(res.responseMetadata.retrieverStatus).toEqual("inprogress");
    expect(res.data).toEqual(null);
  });

  // ensure we're starting with a clean cache and cleaning up after ourselves
  beforeEach(async () => {
    await cacache.rm.all(`${process.env.CACHE_ROOT}/${CacheFolder.test}`);
  });
  afterAll(async () => {
    // await cacache.rm.all(`${process.env.CACHE_ROOT}/${CacheFolder.test}`);
  });
});
