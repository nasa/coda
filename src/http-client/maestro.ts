/*
 * Methods for fetching from Maestro services via CODA's internal API
 */

import { queryStringFromObject } from "utils/formatting";

export async function getMaestroExecuteTimelineStatus(
  executeEventUuid: string
): Promise<WrappedResponse<MaestroInternalAPIData>> {
  const queryParams: GetMaestroExecuteTimelineStatusQueryParams = {
    uuid: executeEventUuid,
  };
  const queryString = queryStringFromObject(queryParams);
  const res = await fetch(`/api/v1/maestro/executeTimelineStatus?${queryString}`);
  const executeTimelineStatus = await res.json();
  return executeTimelineStatus;
}
