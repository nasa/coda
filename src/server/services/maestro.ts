import fetchWithTimeout from "utils/fetch-with-timeout";
import { midnightZulu } from "../../utils/date";

export const fetchMaestroExecuteTimelineStatus = async (
  executeEventUuid: string
): Promise<FetchResponse<MaestroInternalAPIData>> => {
  function activityFromMaestroResponse(
    crewName: string,
    activities: Record<string, MaestroActivityTimelineStatus>,
    midnightUnix: number
  ): Activity[] {
    const resActivities: Activity[] = [];
    for (const activityUuid in activities) {
      const activity: MaestroActivityTimelineStatus = activities[activityUuid];
      if (activity.actors[crewName] !== undefined) {
        const startTime = activity.actors[crewName].startTime
          ? activity.actors[crewName].startTime
          : activity.actors[crewName].plannedStartTime;
        const endTime = activity.actors[crewName].endTime
          ? activity.actors[crewName].endTime
          : activity.actors[crewName].plannedEndTime;
        const startTimeAppSeconds = Math.round(((startTime as number) - midnightUnix) / 1000);
        const endTimeAppSeconds = Math.round(((endTime as number) - midnightUnix) / 1000);
        const duration = endTimeAppSeconds - startTimeAppSeconds;

        const newActivity: Activity = {
          content: activity.title,
          startTimeSeconds: startTimeAppSeconds,
          endTimeSeconds: endTimeAppSeconds,
          duration: duration,
          color: activity.color,
        };

        resActivities.push(newActivity);
      }
    }
    return resActivities;
  }

  try {
    const res = await fetchWithTimeout(
      `https://maestro.fit.nasa.gov/api/v1/event/exetimelinestatus/${executeEventUuid}`
    );
    const resJson = (await res.json()) as MaestroTimelineStatusApiResponse;

    // set the crew using the maestro response
    const crew: Crew = {
      SUIT_IV: resJson.columns[0].display,
      EV1: resJson.columns[1].display,
      EV2: resJson.columns[2].display,
    };

    // get the midnight unix time
    const midnightUnix = midnightZulu(new Date(resJson.timeOfZeroPET as number)).getTime();

    // eva start time in app seconds
    const evaStartSec = resJson.timeOfZeroPET
      ? Math.round(((resJson.timeOfZeroPET as number) - midnightUnix) / 1000)
      : null;

    // eva end time in app seconds
    const evaEndSec = resJson.timeOfEndPET
      ? Math.round(((resJson.timeOfEndPET as number) - midnightUnix) / 1000)
      : null;

    // Convert the maestro response to Activity[] per EV
    const ev1Activity: Activity[] = activityFromMaestroResponse(
      resJson.columns[1].key,
      resJson.activities,
      midnightUnix
    );
    const ev2Activity: Activity[] = activityFromMaestroResponse(
      resJson.columns[2].key,
      resJson.activities,
      midnightUnix
    );

    const maestroInternalAPIData: MaestroInternalAPIData = {
      title: resJson.title,
      crew,
      evaStartSec,
      evaEndSec,
      evaDurationSec: resJson.duration / 1000,
      processedActivitiesData: {
        EV1: ev1Activity,
        EV2: ev2Activity,
      },
    };

    return {
      data: maestroInternalAPIData,
      fetchMetadata: {
        success: true,
        timestamp: new Date().toISOString(),
      },
      source: "maestro",
    };
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : "Unknown Maestro error";
    return {
      data: null,
      fetchMetadata: {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      source: "maestro",
    };
  }
};
