import { useDispatch } from "react-redux";
import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import AVPanels from "components/av-panels";
import { VideoActivity, VideoItem } from "services/io";
import { EVASummaryResponse, ParsedEVADetails } from "services/iss-wiki";
import { TimingData } from "services/io";
import { store } from "store";
import { initialize as initializeEVAs } from "store/evas";
import { initialize as initializeVideos } from "store/videos";
import "utils/scheduler";

/**
 * Renders the main CODA application layout
 */
export default function Main({
  selectedEVA,
  allEVAs,
  gEVADetails,
  gVideoActivityByGroupBySecond,
  gVideoItems,
}: {
  selectedEVA: string;
  allEVAs: EVASummaryResponse;
  gEVADetails: ParsedEVADetails;
  gVideoActivityByGroupBySecond: VideoActivity;
  gVideoItems: VideoItem[];
}) {
  // const dispatch = useDispatch();
  // we're in a browser and the app is loading for the first time,
  // so let's drop data in redux
  // if (typeof window !== "undefined" && !store.getState().videos.initialized) {
  //   dispatch(initializeEVAs({ allEVAs, gEVADetails }));
  //   dispatch(
  //     initializeVideos({
  //       gVideoActivityByGroupBySecond,
  //       gTimingData,
  //       gVideoItems,
  //     })
  //   );
  // }

  return (
    <div>
      <Header
        selectedEVA={selectedEVA}
        allEVAs={allEVAs}
        gEVADetails={gEVADetails}
      />
      <NavTimeline gVideoItems={gVideoItems} />
      <AVPanels
        gVideoActivityByGroupBySecond={gVideoActivityByGroupBySecond}
        gVideoItems={gVideoItems}
      />
    </div>
  );
}
