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

type MaestroTimelineStatusApiResponseSuccess = {
  activities: Record<string, ActivityTimelineStatus>;
  timeOfZeroPET: number | false;
  timeOfEndPET: number | false;
  title: string;
  duration: number;
};

/**
 * Response type when hitting Maestro /api/v1/event/exetimelinestatus/$eventUuid
 */
type MaestroTimelineStatusApiResponse = MaestroTimelineStatusApiResponseSuccess | { error: string };
