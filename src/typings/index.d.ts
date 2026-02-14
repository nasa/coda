interface QueryParams {
  /** yyyy-mm-dd the user wants to view */
  date: string;
  /** UTC hh:mm the user wants to view */
  gmt: string;
  frameworkState: FrameworkState;
  /** Serialized Dockview layout JSON from a v3 share link */
  dockviewLayout?: import("dockview-react").SerializedDockview | null;
}

type FetchOptionsCredentials = "include" | "same-origin" | "omit";
