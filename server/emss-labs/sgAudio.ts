import * as LabsService from "server/services/emss-labs";
import * as WikiService from "server/services/wiki-api";
import { Source } from "utils/enums";
import { Collection } from "utils/enums";

export default async function getLabsSgAudio(
  source: Source,
  dateWanted: string,
  collection: Collection,
  forceNew: boolean
): Promise<WrappedResponse<SgActivityRecord>> {
  const requestedDate = new Date(dateWanted);

  // Fetch source overrides from the wiki for this date. If there are none, then use Imagery Online
  try {
    const mediaOverrides = await WikiService.fetchMediaOverrides(forceNew);

    // Check if there is a media override for this date and Source
    const mediaOverride = mediaOverrides?.data?.find((vo) => {
      const overrideDate = new Date(vo.date);
      return (
        overrideDate.getTime() === requestedDate.getTime() &&
        vo.source === collection &&
        vo.type === "audio"
      );
    });

    // if there are media overrides, use those instead of labs
    if (mediaOverride) {
      return LabsService.fetchSGActivity(source, dateWanted, mediaOverride.url);
    }
  } catch (e) {
    // don't block results if media overrides call fails
    console.error(e);
  }

  return LabsService.fetchSGActivity(source, dateWanted);
}
