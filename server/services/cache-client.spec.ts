import cacache from "cacache";
import fetchWithCache from "server/services/cache-client";

describe("services/cache-client", () => {
  it("should execute a retriever async function when nothing is in the cache", async () => {
    // trick for getting the name of the test, which is always unique. perfect for using as a cache key
    // https://stackoverflow.com/a/62781554
    const identifier = expect.getState().currentTestName;

    let ran = false;
    const retriever = async () => {
      ran = true;
      return {};
    };

    await fetchWithCache(identifier, retriever);

    expect(ran).toBeTruthy();
  });

  it("should return data", async () => {
    const identifier = expect.getState().currentTestName;

    const data = { message: "executed" };
    const retriever = async () => {
      return data;
    };

    const res = await fetchWithCache(identifier, retriever);

    expect(res.data.message).toEqual("executed");
  });

  it("should not execute a retriever async function when the cache is hot", async () => {
    const identifier = expect.getState().currentTestName;

    let runs = 0;
    const retriever = async () => {
      runs += 1;
      return {};
    };

    await fetchWithCache(identifier, retriever);
    await fetchWithCache(identifier, retriever);

    expect(runs).toEqual(1);
  });

  it("should not cache when the retriever throws an error", async () => {
    const identifier = expect.getState().currentTestName;

    let runs = 0;
    const retriever = async () => {
      runs += 1;
      throw new Error("💥");
    };

    let unhandledErrors = 0;
    try {
      await fetchWithCache(identifier, retriever);
    } catch (_e) {
      unhandledErrors += 1;
    }
    try {
      await fetchWithCache(identifier, retriever);
    } catch (_e) {
      unhandledErrors += 1;
    }

    expect(runs).toEqual(2);
    expect(unhandledErrors).toEqual(0);
  });

  it("should run the retriever again if the cache is expired", async () => {
    const identifier = expect.getState().currentTestName;

    let runs = 0;
    const retriever = async () => {
      runs += 1;
      return {};
    };

    await fetchWithCache(identifier, retriever);

    // wait 10 ms
    await (async () => {
      return new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
    })();

    // only accept cache entries younger than 10 ms. the cache entry must be older than 10 ms given the above wait, so the retriever runs again
    await fetchWithCache(identifier, retriever, { cacheAge: 0.01 });

    expect(runs).toEqual(2);
  });

  it("should run the retriever again when opts.preferNew", async () => {
    const identifier = expect.getState().currentTestName;

    let runs = 0;
    const retriever = async () => {
      runs += 1;
      return {};
    };

    await fetchWithCache(identifier, retriever);
    await fetchWithCache(identifier, retriever, { tryFetchNewFirst: true });

    expect(runs).toEqual(2);
  });

  it("should return cached data when the cache is expired, an error occurs, and opts.expiredCacheOkIfFetchFails", async () => {
    const identifier = expect.getState().currentTestName;

    // turn off warning messages about expired data for this test
    const old = console.warn;
    console.warn = () => {};

    let ran = 0;
    const retriever = async () => {
      ran += 1;
      if (ran === 1) {
        // works the first time
        return { message: "Worked!" };
      }
      // fails the second time
      throw new Error("Something went wrong");
    };

    await fetchWithCache(identifier, retriever);

    // wait 10 ms
    await (async () => {
      return new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
    })();

    const res = await fetchWithCache(identifier, retriever, {
      cacheAge: 0.01,
      expiredCacheOkIfFetchFails: true,
    });

    expect(ran).toEqual(2);
    expect(res.data.message).toEqual("Worked!");

    // reset console.warn
    console.warn = old;
  });

  // ensure we're starting with a clean cache and cleaning up after ourselves
  beforeAll(() => {
    cacache.rm.all(process.env.CACHE_ROOT);
  });
  afterAll(() => {
    cacache.rm.all(process.env.CACHE_ROOT);
  });
});
