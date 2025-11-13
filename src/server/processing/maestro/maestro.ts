import * as Maestro from "server/services/maestro";

export default async function getMaestroExecuteTimelineStatus(
  executeEventUuid: string
): Promise<FetchResponse<MaestroInternalAPIData>> {
  return Maestro.fetchMaestroExecuteTimelineStatus(executeEventUuid);
}
