type GraphsManifest = {
  sourceUrl: string;
  /**
   * In seconds. Default: 10. < 1 means don't refresh.
   * If the fetch() call takes longer than this, it will be aborted.
   */
  updateFrequency?: number;
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
  x: (string | number | Date)[] | null;
  y: (string | number)[] | null;
  type: "scatter" | "bar" | "line";
  mode?:
    | "lines"
    | "markers"
    | "text"
    | "lines+markers"
    | "lines+text"
    | "markers+text"
    | "lines+markers+text";
  line?: Partial<Plotly.ScatterLine>;
  name?: string;
};

type AncillaryDataSource = {
  id: number;
  date: string;
  source: Source;
  type: "graphs";
  url: string;
};

type AncillaryDataSource_db_type = AncillaryDataSource;

type AncillaryDataSourceList = Omit<AncillaryDataSource, "ancillaryDataSource">;
