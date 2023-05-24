type MaestroActorTimelineStatus = {
  plannedStartTime: number;
  plannedEndTime: number;
  startTime: number | false;
  endTime: number | false;
  percentComplete: number;
};

type MaestroActivityTimelineStatus = {
  title: string;
  color: string;
  actors: { [key: string]: MaestroActorTimelineStatus };
};

type MaestroColumns = { key: string; display: string };

type MaestroTimelineStatusApiResponse = {
  activities: { [key: string]: MaestroActivityTimelineStatus };
  timeOfZeroPET: number | false;
  timeOfEndPET: number | false;
  title: string;
  duration: number;
  columns: MaestroColumns[];
};

type MaestroInternalAPIData = {
  title: string;
  crew: Crew;
  evaStartSec: number;
  evaEndSec: number;
  evaDurationSec: number;
  processedActivitiesData: { [key: string]: Activity[] };
};
