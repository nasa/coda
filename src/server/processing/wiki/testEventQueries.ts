/**
 * Test Event Cargo Queries
 *
 * Queries for fetching test event data from the exploration wiki using the Cargo API.
 */
import { cargoQueryPaginated } from "./cargo";
import { CargoActorTask } from "./evaQueries";

// =====================
// Test Event Cargo Data Types
// =====================

/** Raw test event data from Cargo query */
interface CargoTestEvent {
  pageName: string;
  "Test date": string | null;
  "UTC Start Date": string | null;
  "UTC Start Hour": string | null;
  "UTC Start Minute": string | null;
  "Test environment": string | null;
  "Flight environment": string | null;
}

// =====================
// Test Event Queries
// =====================

/**
 * Get all test events from the exploration wiki
 */
export async function getAllTestEvents(): Promise<CargoTestEvent[]> {
  const queryParams =
    "tables=Test_event" +
    "&fields=_pageName=pageName,Test_date,UTC_Start_Date,UTC_Start_Hour,UTC_Start_Minute,Test_environment,Flight_environment" +
    "&order_by=Test_date%20DESC" +
    "&limit=500";

  return cargoQueryPaginated<CargoTestEvent>("exploration", queryParams);
}

/**
 * Get as-executed timeline activities for all test events
 */
export async function getTestEventExecution(): Promise<CargoActorTask[]> {
  const queryParams =
    "tables=Actor_task" +
    "&fields=_rowID=rowID,Task_title,Duration_hour,Duration_minute,Related_article,Task_color,Actor_title,_pageName=pageName" +
    "&where=_pageName%20LIKE%20%27Test%20Event%25%2F%25imeline%25%27" +
    "&order_by=Actor_title%20ASC,_rowID%20ASC" +
    "&limit=500";

  return cargoQueryPaginated<CargoActorTask>("exploration", queryParams);
}

/**
 * Get test subjects for test events (to identify which events have subjects)
 */
export async function getTestEventCrews(): Promise<{ pageName: string }[]> {
  const queryParams = "tables=Test_subject" + "&fields=_pageName=pageName" + "&limit=500";

  return cargoQueryPaginated<{ pageName: string }>("exploration", queryParams);
}
