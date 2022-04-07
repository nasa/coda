// Bad words filter

export async function fetchLabsTranscripts(
  source: Source,
  dateWanted: string
): Promise<WrappedResponse<UnprocessedTranscript[]>> {
  const transcripts: UnprocessedTranscript[] = [];

  const filter = require("leo-profanity");
  filter.loadDictionary();

  // Get all 4 S/G transcript files. If 404 is returned, then return an empty unprocessed utterance array.
  for (let i = 1; i <= 4; i++) {
    const url = `https://emss-labs.fit.nasa.gov/transcriptions/${dateWanted}/transcript-SG${i}.json`;
    const unprocessedTranscript: UnprocessedTranscript = {
      sgNum: i,
      unprocessedUtterances: [],
    };
    try {
      const res = await fetch(url);
      unprocessedTranscript.unprocessedUtterances = await res.json();
    } catch (e) {
      unprocessedTranscript.unprocessedUtterances = [];
    }
    // Filter the utterances for bad words
    unprocessedTranscript.unprocessedUtterances.forEach((utterance) => {
      utterance[2] = filter.clean(utterance[2]);
    });
    transcripts[i - 1] = unprocessedTranscript;
  }

  const returnVal: WrappedResponse<UnprocessedTranscript[]> = {
    cacheMetadata: { fromCache: false, stale: false, timestamp: new Date() },
    data: transcripts,
  };

  return returnVal;
}
