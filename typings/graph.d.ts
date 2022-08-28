type GraphManifest = {
  graphs: Graph[];
};

type Graph = {
  id: string;
  title: string;
  type: "line";
  dataURL: string;
  dataParserFunctionName: string;
};

type HeartrateData = {
  timestamp: Date;
  heartrate: number;
};
