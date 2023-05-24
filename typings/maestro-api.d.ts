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
  actors: Record<string, ActorTimelineStatus>;
};

type MaestroActor = { key: string; display: string };

type MaestroTimelineStatusApiResponse = {
  activities: Record<string, MaestroActivityTimelineStatus>;
  timeOfZeroPET: number | false;
  timeOfEndPET: number | false;
  title: string;
  duration: number;
  columns: MaestroActor[];
};
