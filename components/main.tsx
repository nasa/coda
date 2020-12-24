import Header from "components/header";
import NavTimeline from "components/nav-timeline";
import AVPanels from "components/av-panels";
import "utils/scheduler";

/**
 * Renders the main CODA application layout
 */
export default function Main() {
  return (
    <div>
      <Header />
      <NavTimeline />
      <AVPanels />
    </div>
  );
}
