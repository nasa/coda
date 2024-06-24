import { queryStringFromObject } from "utils/formatting";

export async function buildEphemerisStore(
  dateWanted: string
): Promise<WrappedResponse<EphemerisStore>> {
  const queryParams: GetEphemerisQueryParams = {
    dateWanted,
  };
  const queryString = queryStringFromObject(queryParams);
  const res = await fetch(`/api/v1/location/iss?${queryString}`);
  const wrappedResponse: WrappedResponse<EphemerisStore> = await res.json();
  return wrappedResponse;
}
