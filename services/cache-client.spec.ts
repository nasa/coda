import cacache from "cacache";
import retrieveJSON from "services/cache-client";

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

    await retrieveJSON(identifier, retriever);

    expect(ran).toBeTruthy();
  });

  it("should not execute a retriever async function when something is in the cache", async () => {
    const identifier = expect.getState().currentTestName;

    let runs = 0;
    const retriever = async () => {
      runs += 1;
      return {};
    };

    await retrieveJSON(identifier, retriever);
    await retrieveJSON(identifier, retriever);

    expect(runs).toEqual(1);
  });

  it("should not cache when the retriever throws an error", async () => {
    const identifier = expect.getState().currentTestName;

    let runs = 0;
    const retriever = async () => {
      runs += 1;
      throw new Error("💥");
    };

    try {
      await retrieveJSON(identifier, retriever);
    } catch (_e) {}
    try {
      await retrieveJSON(identifier, retriever);
    } catch (_e) {}

    expect(runs).toEqual(2);
  });

  it("should run the retriever again if the cache is stale", async () => {
    const identifier = expect.getState().currentTestName;

    let runs = 0;
    const retriever = async () => {
      runs += 1;
      return {};
    };

    try {
      await retrieveJSON(identifier, retriever);
    } catch (_e) {}

    await (async () => {
      return new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
    })();

    try {
      await retrieveJSON(identifier, retriever, { cacheAge: 0.01 });
    } catch (_e) {}

    expect(runs).toEqual(2);
  });

  it("should not run the retriever again if the cache is hot", async () => {
    const identifier = expect.getState().currentTestName;

    let runs = 0;
    const retriever = async () => {
      runs += 1;
      return {};
    };

    try {
      await retrieveJSON(identifier, retriever);
    } catch (_e) {}

    await (async () => {
      return new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
    })();

    try {
      await retrieveJSON(identifier, retriever, { cacheAge: 0.01 });
    } catch (_e) {}

    expect(runs).toEqual(2);
  });

  // ensure we're starting with a clean slate and cleaning up after ourselves
  beforeAll(() => {
    cacache.rm.all(process.env.CACHE_ROOT);
  });
  afterAll(() => {
    cacache.rm.all(process.env.CACHE_ROOT);
  });
});
