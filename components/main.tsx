import { useReducer } from "react";
import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import AVPanels from "components/av-panels";
import reducer, { initialState } from "store/reducer";
import { TimeSyncDispatch, TimeSyncState } from "store/contexts";

/**
 * Renders the main CODA application layout
 */
export default function Main({
  selectedEVA,
  allEVAs,
  gEVADetails,
  gTimingData,
  gVideoActivityByGroupBySecond,
  gVideoItems,
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <TimeSyncDispatch.Provider value={dispatch}>
      <TimeSyncState.Provider value={state}>
        <Header
          selectedEVA={selectedEVA}
          allEVAs={allEVAs}
          gEVADetails={gEVADetails}
        />
        <NavTimeline gTimingData={gTimingData} gVideoItems={gVideoItems} />
        <AVPanels
          gVideoActivityByGroupBySecond={gVideoActivityByGroupBySecond}
          gVideoItems={gVideoItems}
        />
      </TimeSyncState.Provider>
    </TimeSyncDispatch.Provider>
  );
}
