import fetchWithTimeout from "utils/fetch-with-timeout";
import { getMediaOverridesList } from "server/express/routes/db/mediaOverrides";

export default async function getTalkybotSgAudio({
  source,
  dateWanted,
}: {
  source: Source;
  dateWanted: string; //yy-mm-dd
}): Promise<FetchResponse<SgActivityFullUrlRecord>> {
  const requestedDate = new Date(dateWanted);

  // Fetch source overrides from the database for this date
  try {
    const mediaOverrides = await getMediaOverridesList();

    // Check if there is a media override for this date and Source
    const mediaOverride = mediaOverrides?.find((vo) => {
      const overrideDate = new Date(vo.date);
      return (
        overrideDate.getTime() === requestedDate.getTime() &&
        vo.source === source &&
        vo.type === "audio"
      );
    });

    // if there are media overrides, use those
    if (mediaOverride) {
      const res: SgActivityFullUrlRecord = await fetchTalkybotSGAudio({
        source,
        dateWanted,
        overrideBaseUrl: mediaOverride.url,
      });
      return {
        data: res,
        fetchMetadata: {
          success: true,
          timestamp: new Date().toISOString(),
        },
        origin: "override",
      };
    }
  } catch (e) {
    // don't block results if media overrides call fails
    console.error(e);
  }

  // Fetch SG audio from Talkybot
  const res: SgActivityFullUrlRecord = await fetchTalkybotSGAudio({
    source,
    dateWanted,
  });
  return {
    data: res,
    fetchMetadata: {
      success: true,
      timestamp: new Date().toISOString(),
    },
    origin: "talky-bot",
  };
}

export async function fetchTalkybotSGAudio({
  source,
  dateWanted,
  overrideBaseUrl,
}: {
  source: Source;
  dateWanted: string;
  overrideBaseUrl?: string;
}): Promise<SgActivityFullUrlRecord> {
  // if override URL is provided, use it
  if (overrideBaseUrl) {
    const url = `${overrideBaseUrl}/audioManifest.json`;
    let dayActivities: SgVideoRecord[] = [];

    try {
      const res = await fetchWithTimeout(url);
      dayActivities = (await res.json()) as SgVideoRecord[];
    } catch (e) {
      dayActivities = [];
    }

    const sgActivityRangeFullUrlRecords: SgActivityRangeFullUrlRecord[][] = [];
    for (let sgChannel = 0; sgChannel <= 3; sgChannel++) {
      const sgActivityRangeFullUrlRecord: SgActivityRangeFullUrlRecord[] = [];
      for (let videoIndex = 0; videoIndex < dayActivities.length; videoIndex++) {
        const video = dayActivities[videoIndex];
        const activityRanges = video.sgChannels[sgChannel].activity_ranges;
        const reducedActivityRanges: SgActivityRangeFullUrlRecord[] = activityRanges.map(
          (activityRange) => {
            return {
              sound_start_secs: activityRange.sound_start_secs + video.start_seconds,
              sound_stop_secs: activityRange.sound_stop_secs + video.start_seconds,
              aacSegmentFullUrl: `${overrideBaseUrl}/audio/${activityRange.aacSegmentFilename}`,
            };
          }
        );
        sgActivityRangeFullUrlRecord.push(...reducedActivityRanges);
      }
      sgActivityRangeFullUrlRecord.sort((a, b) =>
        a.sound_start_secs > b.sound_start_secs
          ? 1
          : b.sound_start_secs > a.sound_start_secs
            ? -1
            : 0
      );
      sgActivityRangeFullUrlRecords.push(sgActivityRangeFullUrlRecord);
    }

    return {
      override: true,
      sgActivityRangeFullUrlRecords: sgActivityRangeFullUrlRecords,
    };
  }

  // if not ISS return nothing
  if (source !== "ISS") {
    return {
      override: false,
      sgActivityRangeFullUrlRecords: [[], [], [], []],
    } as SgActivityFullUrlRecord;
  }

  const url = `${process.env.TALKYBOT_URL}/api/v1/external/manifest/${dateWanted}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    return {
      override: false,
      sgActivityRangeFullUrlRecords: [[], [], [], []],
    } as SgActivityFullUrlRecord;
  }

  const resJson = await res.json();
  const manifest: TBExternalManifest = resJson;

  const sgActivityRangeFullUrlRecords: SgActivityRangeFullUrlRecord[][] = [];
  for (let sgChannel = 1; sgChannel <= 4; sgChannel++) {
    const sgChannels = manifest.channels;
    // get the activity ranges for the sgChannel using the sgChannel property in sgChannels
    const activity = sgChannels.find((val) => val.channel === sgChannel).activity;
    const sgChannelActivityRangeFullUrlRecord: SgActivityRangeFullUrlRecord[] = activity.map(
      (val) => {
        return {
          sound_start_secs: val.start,
          sound_stop_secs: val.stop,
          aacSegmentFullUrl: `${process.env.TALKYBOT_URL}/api/v1/external/audiofiles/${val.uuid}/file`,
        };
      }
    );
    sgActivityRangeFullUrlRecords.push(sgChannelActivityRangeFullUrlRecord);
  }

  return {
    override: false,
    sgActivityRangeFullUrlRecords: sgActivityRangeFullUrlRecords,
  };
}
