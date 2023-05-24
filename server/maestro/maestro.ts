import * as Maestro from "server/services/maestro";

export default async function getMaestroExecuteTimelineStatus(
  executeEventUuid: string
): Promise<WrappedResponse<any>> {
  return Maestro.fetchMaestroExecuteTimelineStatus(executeEventUuid);
}
