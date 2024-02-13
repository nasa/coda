type UnprocessedUtterance = [number, string, string];

interface UnprocessedTranscript {
  sgNum: number;
  unprocessedUtterances: UnprocessedUtterance[];
}

interface Transcript {
  utterances: Utterance[];
}

interface Utterance {
  id: number;
  secs: number;
  time: string;
  speaker: string;
  content: string;
}
