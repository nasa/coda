import { Collection } from "utils/enums";

export async function getTranscripts(
  source: Source,
  year: number,
  month: number,
  date: number,
  collection: Collection
): Promise<WrappedResponse<UnprocessedTranscript[]>> {
  const res = await fetch(
    `/api/v1/emss-labs/transcripts?source=${source}&year=${year}&month=${month}&date=${date}&collection=${collection}`
  );
  const transcripts: WrappedResponse<UnprocessedTranscript[]> = await res.json();

  return transcripts;
}

export async function getSgAudio(
  source: Source,
  year: number,
  month: number,
  date: number,
  collection: Collection
): Promise<WrappedResponse<SgActivityRecord>> {
  const res = await fetch(
    `/api/v1/emss-labs/sgAudio?source=${source}&year=${year}&month=${month}&date=${date}&collection=${collection}`
  );
  const sgAudio: WrappedResponse<SgActivityRecord> = await res.json();

  return sgAudio;
}
