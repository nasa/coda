import { queryStringFromObject } from "utils/formatting";

export async function getTranscripts(
  dateWanted: string,
  source: Source
): Promise<WrappedResponse<UnprocessedTranscript[]>> {
  const queryParams: GetTranscriptsQueryParams = {
    dateWanted,
    source,
  };
  const queryString = queryStringFromObject(queryParams);
  const res = await fetch(`/api/v1/emss/transcripts?${queryString}`);
  const transcripts: WrappedResponse<UnprocessedTranscript[]> = await res.json();

  return transcripts;
}

export async function getSgAudio(
  dateWanted: string,
  source: Source
): Promise<WrappedResponse<SgActivityFullUrlRecord>> {
  const queryParams: GetSgAudioQueryParams = {
    dateWanted,
    source,
  };
  const queryString = queryStringFromObject(queryParams);
  const res = await fetch(`/api/v1/emss/sgAudio?${queryString}`);
  const sgAudio: WrappedResponse<SgActivityFullUrlRecord> = await res.json();

  return sgAudio;
}
