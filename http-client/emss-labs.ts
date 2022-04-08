export async function getTranscripts(
  source: Source,
  year: number,
  month: number,
  date: number
): Promise<WrappedResponse<UnprocessedTranscript[]>> {
  const res = await fetch(
    `/api/emss-labs/transcripts?source=${source}&year=${year}&month=${month}&date=${date}`
  );
  const transcripts: WrappedResponse<UnprocessedTranscript[]> = await res.json();

  return transcripts;
}
