/**
 * ISS EVA Cargo Queries
 *
 * Queries for fetching EVA data from the ISS wiki using the Cargo API.
 */
import { cargoQueryPaginated } from "./cargo";

// =====================
// EVA Cargo Data Types
// =====================

/** Raw EVA data from Cargo query */
interface CargoEVA {
  pageName: string;
  "EVA title": string | null;
  "Maestro event uuid": string | null;
  "Start date": string | null;
  "Start hour": string | null;
  "Start minute": string | null;
  "Duration hour": string | null;
  "Duration minute": string | null;
}

/** Raw actor task data from Cargo query */
export interface CargoActorTask {
  rowID: string;
  "Task title": string | null;
  "Duration hour": string | null;
  "Duration minute": string | null;
  "Related article": string | null;
  "Task color": string | null;
  "Actor title": string | null;
  pageName: string;
}

/** Raw crew data from Cargo query */
export interface CargoCrew {
  pageName: string;
  "Crew name": string | null;
  "Crew role": string | null;
  "EMU SN": string | null;
}

// =====================
// EVA Queries
// =====================

/**
 * Get all EVA metadata from the wiki
 * Query: EVAs with Classification = 'Scheduled or Historical'
 */
export async function getAllEVAs(): Promise<CargoEVA[]> {
  const queryParams =
    "tables=EVA" +
    "&fields=_pageName=pageName,EVA_title,Maestro_event_uuid,Start_date,Start_hour,Start_minute,Duration_hour,Duration_minute" +
    "&where=_pageName%20LIKE%20%27%25S%20EVA%25%27%20AND%20EVA_Classification%20=%20%27Scheduled%20or%20Historical%27" +
    "&order_by=Start_date%20DESC" +
    "&limit=500";

  return cargoQueryPaginated<CargoEVA>("iss", queryParams);
}

/**
 * Get as-executed timeline activities for all EVAs
 * Query: Actor tasks from pages matching "US EVA.../As-executed..."
 */
export async function getAllAsExecuted(): Promise<CargoActorTask[]> {
  const queryParams =
    "tables=Actor_task" +
    "&fields=_rowID=rowID,Task_title,Duration_hour,Duration_minute,Related_article,Task_color,Actor_title,_pageName=pageName" +
    "&where=_pageName%20LIKE%20%27US%20EVA%25%2F%25xecuted%25%27" +
    "&order_by=Actor_title%20ASC,_rowID%20ASC" +
    "&limit=500";

  return cargoQueryPaginated<CargoActorTask>("iss", queryParams);
}

/**
 * Get crew assignments for all EVAs
 * Query: Crew involved with US EVAs
 */
export async function getAllCrew(): Promise<CargoCrew[]> {
  const queryParams =
    "tables=EVA,Crew_involved_with_subject" +
    "&join_on=EVA._pageName=Crew_involved_with_subject._pageName" +
    "&fields=Crew_involved_with_subject._pageName=pageName,Crew_name,Crew_involved_with_subject.Crew_role,Crew_involved_with_subject.EMU_SN" +
    "&where=Crew_involved_with_subject._pageName%20LIKE%20%27US%20EVA%25%27%20AND%20EVA.Country_performing_EVA%20=%20%27US%27%20AND%20EVA.EVA_type%20=%20%27ISS%27" +
    "&limit=500";

  return cargoQueryPaginated<CargoCrew>("iss", queryParams);
}
