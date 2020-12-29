import { useStore } from "react-redux";
import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import AVPanels from "components/av-panels";
import { getApplicationUTC, historySelector } from "store/clock";
// import handleSync from "utils/sync";

let interval;

/**
 * Renders the main CODA application layout
 */
export default function Main() {
  // the server shouldn't be running clocks!!!
  if (typeof window !== "undefined" && !interval) {
    const store = useStore();

    interval = setInterval(() => {
      const { clock } = store.getState();
      const GMT = getApplicationUTC(historySelector(clock));
      // console.log(GMT);
      // checkVideoChange(state);
    }, 1000);

    // const handleSync = () => {};

    // const unsubscribe = store.subscribe(handleSync);
  }

  return (
    <div>
      <Header />
      <NavTimeline />
      <AVPanels />
    </div>
  );
}
