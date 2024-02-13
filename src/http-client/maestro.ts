/*
 * Methods for fetching from Maestro services via CODA's internal API
 */

export async function getMaestroExecuteTimelineStatus(
  executeEventUuid: string
): Promise<WrappedResponse<MaestroInternalAPIData>> {
  const res = await fetch(`/api/v1/maestro/executeTimelineStatus?uuid=${executeEventUuid}`);
  const executeTimelineStatus = await res.json();
  return executeTimelineStatus;
}
