interface Utterance {
  secs: number;
  time: string;
  speaker: string;
  content: string;
}

type UnprocessedUtterance = [number, string, string];
