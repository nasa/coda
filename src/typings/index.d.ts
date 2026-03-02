interface QueryParams {
  /** yyyy-mm-dd the user wants to view */
  date: string;
  /** UTC hh:mm the user wants to view */
  gmt: string;
  frameworkState: FrameworkState;
  /** Fully-specified Dockview layout decoded from a v3 share URL. */
  dockviewLayout: import("dockview-react").SerializedDockview | null;
}

type FetchOptionsCredentials = "include" | "same-origin" | "omit";
