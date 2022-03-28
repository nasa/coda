interface Utterance {
  secs: number;
  speaker: string;
  content: string;
}

type UnprocessedUtterance = [number, string, string];
