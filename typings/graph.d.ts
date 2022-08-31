type GraphsManifest = {
  sourceUrl: string;
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

type PlotlyChartTrace = {
  x: string[];
  y: number[];
  type: string;
  mode: string;
  line: {
    color: string;
  };
  name: string;
};
