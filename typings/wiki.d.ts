interface WikiResponse {
  errorResponse: boolean;
  code: string;
  info: string;
  response: {
    error: {
      code: string;
      info: string;
      "*": string;
    };
  };
  request: Request;
}

interface WikiResults {
  query?: {
    printrequests: {
      label: string;
      key: string;
      redi: string;
      typeid: string;
      mode: number;
      format?: string;
    }[];
    results: EVASummaryResponse | EVADetails | any;
  };
  parse?: {
    wikitext?: { [key: string]: string };
    links?: [{ [key: string]: string }];
  };
}

/** EVA Metadata */
interface EVADetails {
  [key: string]: {
    printouts: {
      "EVA Title": string[];
      "Start date": WikiTimestamp[];
      /** In H:MM, eg `[ 6:32 ]`. Defaults to `[ : ]` when no duration is present */
      Duration: string[];
    };
    /** eg. `US EVA 1` */
    fulltext: string;
    /** Full link to the page on the wiki */
    fullurl: string;
    namespace: number;
    exists: "0" | "1";
    displaytitle: string;
  };
}

interface EVAAsExecuted {
  /** keyed in the form of `US EVA 55/As-executed summary timeline# 868b8afb495ff99585ccfea0263fec03` */
  [key: string]: {
    printouts: {
      Index: number[];
      "Has text title": string[];
      "Duration hour": number[];
      "Duration minute": number[];
      "Related article": any[];
      Color: string[];
      Actor: string[];
    };
  };
}

interface AllExecution {
  /** Keyed as EVA name, upper-cased with spaces, eg. `US EVA 55` */
  [key: string]: {
    /** Keyed as actor name, eg `EV1`, or a proper name, eg. `Bob` */
    [key: string]: Activity[];
  };
}

interface WikiTimestamp {
  /** eg. `1014163200` */
  timestamp: string;
  /** eg. `1/2002/2/20` */
  raw: string;
}

/** Summary of an EVA in wiki query results */
interface EVASummaryResponse {
  /** Keyed by EVA title, eg `US EVA 1` */
  [key: string]: {
    printouts: {
      "EVA title": string[];
      "Start date": WikiTimestamp[];
      /** eg. `[ 11:38 ]` */
      "Start Time": string[];
      /** In H:MM, eg `[ 6:32 ]`. Defaults to `[ : ]` when no duration is present */
      Duration: string[];
    };
    /** eg. `US EVA 1` */
    fulltext: string;
    /** Full link to the page on the wiki */
    fullurl: string;
    namespace: number;
    exists: "0" | "1";
    displaytitle: string;
  };
}

interface EVACrewResults {
  /** keyed in the form of `US EVA 55# a4c086604b5aa243bf1f3c99dc06d965` */
  [key: string]: {
    printouts: {
      "Has full name": [
        {
          fulltext: string;
        }
      ];
      "Has role": [
        {
          fulltext: string;
        }
      ];
    };
  };
}

interface JSCRockYardResults {
  /** keyed in the form of `US EVA 55# a4c086604b5aa243bf1f3c99dc06d965` */
  [key: string]: {
    printouts: {
      "Has full name": [
        {
          fulltext: string;
        }
      ];
      "Has role": [
        {
          fulltext: string;
        }
      ];
    };
  };
}

interface WikiTextPrintout {
  fulltext: string;
  fullurl: string;
  namespace: number;
  exists: "0" | "1";
  displayTitle: string;
}

interface AllTestEvents {
  /** Keyed by Test event, eg `Test Event:1` */
  [key: string]: {
    printouts: {
      "Test date": WikiTimestamp[];
      "Test environment": WikiTextPrintout[];
      "Flight environment": WikiTextPrintout[];
      /** eg. `[ 11:38 ]` */
      "Start time": string[];
    };
    /** eg. `Test Event:1` */
    fulltext: string;
    /** Full link to the page on the wiki */
    fullurl: string;
    namespace: number;
    exists: "0" | "1";
    displaytitle: string;
  };
}

/** Manual overrides for  */

interface DatetimeOverrides {
  videoFixes: VideoFix[];
  testEventTimezones: TestEventOffsets[];
}

interface VideoFix {
  /** nasa_id of the video */
  videoID: string;
  /** UTC string for the actual start of the video */
  time: string;
}

interface TestEventOffsets {
  /** Match test event to the ID in the wiki */
  testEventID: string;
  /** In the form of UTC-05:00 */
  timeoffset: string;
}

/** API query options */
type AgencyQuery = "us" | "rs" | "all";
