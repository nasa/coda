import fetchWithTimeout from "utils/fetch-with-timeout";

export const fetchMaestroExecuteTimelineStatus = async (
  executeEventUuid: string
): Promise<WrappedResponse<GraphsManifest>> => {
  try {
    console.log(executeEventUuid);
    const res = await fetchWithTimeout(
      "https://maestro-dev.fit.nasa.gov/api/v1/event/exetimelinestatus/bbb19373-1695-4378-ad1d-d82cbe74a8c5"
    ); //TODO: replace with executeEventUuid when ready
    const resJson = await res.json();
    return {
      data: resJson,
      cacheMetadata: { fromCache: false, timestamp: new Date(), expiration: null, error: null },
    };
  } catch (e) {
    console.error(e);
    return {
      data: null,
      cacheMetadata: {
        fromCache: false,
        timestamp: new Date(),
        expiration: null,
        error: e.toString(),
      },
    };
  }
};
