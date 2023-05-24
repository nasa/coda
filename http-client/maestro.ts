/*
 * Methods for fetching from Maestro services via CODA's internal API
 */

export async function getMaestroExecuteTimelineStatus(
  executeEventUuid: string
): Promise<WrappedResponse<MaestroTimelineStatusApiResponse>> {
  const res = await fetch(`/api/maestro/executeTimelineStatus?uuid${executeEventUuid}`);
  const executeTimelineStatus = await res.json();
  return executeTimelineStatus;
}
