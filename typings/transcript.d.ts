interface Utterance {
  id: number;
  secs: number;
  time: string;
  speaker: string;
  content: string;
}

type UnprocessedUtterance = [number, string, string];
