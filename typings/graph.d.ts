type GraphsManifest = {
  sourceUrl: string;

  /**
   * Options required to be added to the fetch() call that retrieves this graph data.
   * Ref: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
   */
  fetchOptions?: {
    /**
     * Default: same-origin. If hitting an API that requires authentication, you may need to
     * specify "include". This will likely require the API have the Access-Control-Allow-Credentials
     * header set to "true".
     */
    credentials: FetchOptionsCredentials;
  };
  graphs: Graph[];
};

type Graph = {
  id: string;
  title: string;
  type: "line" | "GandalfHeartrate";
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
