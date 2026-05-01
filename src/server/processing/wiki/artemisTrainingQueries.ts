/**
 * Artemis Training (AxEMU) Cargo Queries
 *
 * Queries for fetching AxEMU training event data from the exploration wiki using the Cargo API.
 * Uses the AxEMU_Training_Event table for event metadata and Actor_task for timeline data.
 */
import { cargoQueryPaginated } from "./cargo";
import { CargoActorTask } from "./evaQueries";

// =====================
// AxEMU Training Event Cargo Data Types
// =====================

/** Raw AxEMU training event data from Cargo query */
export interface CargoAxEMUTrainingEvent {
  pageName: string;
  "Event Title": string | null;
  "Event Date": string | null;
  startTime?: string | null;
  endTime?: string | null;
  EV1: string | null;
  EV2: string | null;
  "Test Environment": string | null;
}

// =====================
// AxEMU Training Event Queries
// =====================

/**
 * Get all AxEMU training events from the exploration wiki
 */
export async function getAllAxEMUTrainingEvents(): Promise<CargoAxEMUTrainingEvent[]> {
  const queryParams =
    "tables=AxEMU_Training_Event" +
    "&fields=_pageName=pageName,Event_Title,Event_Date,UTC_Start_Time=startTime,UTC_End_Time=endTime,EV1,EV2,Test_Environment" +
    "&order_by=Event_Date%20DESC" +
    "&limit=500";

  return cargoQueryPaginated<CargoAxEMUTrainingEvent>("exploration", queryParams);
}

/**
 * Get as-executed timeline activities for AxEMU training events.
 *
 * Because AxEMU training event page names don't share a single prefix,
 * we first fetch all event page names from AxEMU_Training_Event, then build
 * a WHERE clause to match their "/Timeline - As Executed" subpages in Actor_task.
 */
export async function getAxEMUTrainingExecution(
  eventPageNames: string[]
): Promise<CargoActorTask[]> {
  if (eventPageNames.length === 0) {
    return [];
  }

  // Build OR conditions for each event's timeline page pattern
  // e.g., _pageName LIKE 'NBL Training Development 1/%xecuted%' OR _pageName LIKE '...'
  const conditions = eventPageNames
    .map((name) => {
      const escaped = name.replace(/'/g, "\\'");
      return `_pageName LIKE '${escaped}/%xecuted%'`;
    })
    .join(" OR ");

  const queryParams =
    "tables=Actor_task" +
    "&fields=_rowID=rowID,Task_title,Duration_hour,Duration_minute,Related_article,Task_color,Actor_title,_pageName=pageName" +
    `&where=${encodeURIComponent(conditions)}` +
    "&order_by=Actor_title%20ASC,_rowID%20ASC" +
    "&limit=500";

  return cargoQueryPaginated<CargoActorTask>("exploration", queryParams);
}
