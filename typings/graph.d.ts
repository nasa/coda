type GraphsManifest = {
  sourceUrl: string;
  graphs: Graph[];
};

type Graph = {
  id: string;
  title: string;
  type: "GandalfHeartrate";
  dataURL: string;
  data?: GraphData[];
};

type GraphData = {
  timestamp: string;
  value: number;
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
