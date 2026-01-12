/** A large contiguous section of the timeline representing an event at a location, eg. an EVA on ISS */
interface Sequence {
  /** The mission associated with this sequence */
  location: Collection;
  /** Broad category of this sequence */
  type: SequenceType;
  /** Short identifier, eg. `US EVA 55` */
  name: string;
  /** Descriptive title, eg. `US EVA IDA3 Install` */
  displayTitle: string;
  /** Where users can get more information */
  dataURL: string;
  /** HH:MM UTC */
  startTime?: string;
  /** YYYY-MM-DD UTC */
  startDate: string;
  /** YYYY-MM-DD UTC */
  endDate?: string;
  /** seconds */
  duration: number;
  /** People responsible for this sequence */
  crew?: Crew;
  /** List of activities performed by crew, keyed by actor (e.g., EV1, EV2) */
  asPerformed: ActorActivities;
  /** List of planned activities for the crew, keyed by actor */
  asPlanned?: ActorActivities;
  /**
   * UUID of event in Maestro, as recorded on wiki page, if there is one.
   * Enables hitting maestro endpoint /api/v1/event/exetimelinestatus/:uuid
   */
  maestroEventUuid?: string | false;
}

/** Activities grouped by actor name (e.g., EV1, EV2) */
interface ActorActivities {
  [actor: string]: Activity[];
}

/** Crew names keyed by actor, eg. `{EV1: "Bob"}` */
interface Crew {
  EV1: string;
  EV2: string;
  SUIT_IV: string;
}

/** Largest chunk of time within a Sequence */
interface Activity {
  /** Description of the activity */
  content: string;
  /** Color to use when rendering this activity */
  color: string;
  /** seconds */
  duration: number;
  /** Seconds into the UTC day */
  startTimeSeconds?: number;
  /** Seconds into the UTC day */
  endTimeSeconds?: number;
}

// =====================
// Wiki Types
// =====================

/** Wiki names used for authentication and API calls */
type WikiName = "iss" | "exploration";

// =====================
// Wiki Authentication Types
// =====================

/** Response from MediaWiki token request */
interface WikiTokenResponse {
  query?: {
    tokens?: {
      logintoken?: string;
    };
  };
}

/** Response from MediaWiki login request */
interface WikiLoginResponse {
  login?: {
    result: string;
    lguserid?: number;
    lgusername?: string;
  };
}

// =====================
// Cargo API Types
// =====================

/** Generic Cargo query result row */
interface CargoRow<T> {
  title: T;
}

/** Generic Cargo query response */
interface CargoResponse<T> {
  cargoquery?: CargoRow<T>[];
  error?: {
    code: string;
    info: string;
  };
}
