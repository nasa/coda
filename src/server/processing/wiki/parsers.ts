/**
 * Wiki Data Parsers
 *
 * Functions for parsing raw Cargo query results into structured data.
 */
import { CargoActorTask, CargoCrew } from "./evaQueries";

/** Color translator for EVA timeline activities - converts wiki color names to hex codes */
const colorTranslator: Record<string, string> = {
  red: "#C0392B",
  grey: "#7F8C8D",
  gray: "#7F8C8D",
  blue: "#2980B9",
  orange: "#CA6F1E",
  green: "#28B463",
  purple: "#8E44AD",
  yellow: "#B7950B",
  white: "#96a5a7",
  black: "#000000",
  pink: "#FFC0CB",
};

// =====================
// Internal Parsing Types
// =====================

/** Keyed by EVA/event name, then by actor - used for intermediate parsing */
interface ParsedExecution {
  [eventName: string]: ActorActivities;
}

/** Keyed by EVA name (lowercase with underscores) - used for intermediate parsing */
interface ParsedCrews {
  [evaName: string]: Crew;
}

// =====================
// Parsing Functions
// =====================

/**
 * Parse as-executed timeline data into the expected format grouped by event name and actor.
 *
 * @param tasks - Raw Actor_task rows from Cargo query
 * @param actorOffset - Actor number offset for EV mapping.
 *   - `1` (default): "Actor 2" → EV1, "Actor 3" → EV2 (ISS EVAs where Actor 1 is SSRMS)
 *   - `0`: "Actor 1" → EV1, "Actor 2" → EV2 (AxEMU training where Actor 1 is the suited crew)
 */
export function parseAsExecuted(tasks: CargoActorTask[], actorOffset = 1): ParsedExecution {
  const result: ParsedExecution = {};

  for (const task of tasks) {
    // Extract event name from page path (e.g., "US EVA 50/As-Executed Timeline" -> "US EVA 50")
    const eventName = task.pageName.split("/")[0];

    if (!result[eventName]) {
      result[eventName] = {};
    }

    // Normalize actor names using the offset:
    //   actorOffset=1: "Actor 2" → EV1, "Actor 3" → EV2 (skip Actor 1 = SSRMS)
    //   actorOffset=0: "Actor 1" → EV1, "Actor 2" → EV2 (no SSRMS)
    let actor = task["Actor title"] || "";
    if (actor.startsWith("Actor")) {
      const actorNumber = parseInt(actor.replace("Actor", "").trim(), 10);
      if (actorNumber <= actorOffset && actorOffset > 0) {
        continue; // Skip actors below the offset (e.g., Actor 1 = SSRMS for ISS EVAs)
      }
      actor = `EV${actorNumber - actorOffset}`;
    }

    if (!result[eventName][actor]) {
      result[eventName][actor] = [];
    }

    // Calculate duration in seconds
    const hours = parseInt(task["Duration hour"] || "0", 10);
    const minutes = parseInt(task["Duration minute"] || "0", 10);
    const durationSeconds = hours * 3600 + minutes * 60;

    // Translate color name to hex code
    const colorName = (task["Task color"] || "gray").toLowerCase();
    const color = colorTranslator[colorName] || colorTranslator.gray;

    // Clean up title (remove wiki link brackets)
    const content = (task["Task title"] || "").replace(/\[\[/g, "").replace(/\]\]/g, "");

    result[eventName][actor].push({
      content,
      duration: durationSeconds,
      color,
    });
  }

  return result;
}

/**
 * Parse crew data into the expected format keyed by EVA name
 */
export function parseCrews(crewData: CargoCrew[]): ParsedCrews {
  const result: ParsedCrews = {};

  for (const crew of crewData) {
    const evaName = crew.pageName.replace(/ /g, "_").toLowerCase();
    const role = (crew["Crew role"] || "").toUpperCase().replace(/ /g, "_");

    if (!role || (role !== "EV1" && role !== "EV2" && role !== "SUIT_IV")) {
      continue;
    }

    if (!result[evaName]) {
      result[evaName] = { EV1: "", EV2: "", SUIT_IV: "" };
    }

    result[evaName][role as keyof Crew] = crew["Crew name"] || "";
  }

  return result;
}
