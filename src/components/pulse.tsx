import { FunctionComponent, useEffect } from "react";
import { makePulseTrackCall } from "utils/pulseAnalytics";

const PulseAnyatics: FunctionComponent = () => {
  /**
   * Add "?sleep=10" URL parameter to track.js to simulate a slow load by 10 seconds
   *
   * This component will mount/unmount twice on dev due to React.StrictMode which will cause 2 track calls.
   * This does not happen on prod.
   * https://stackoverflow.com/questions/61254372/my-react-component-is-rendering-twice-because-of-strict-mode
   */
  useEffect(() => {
    const script = document.createElement("script");
    script.async = true;

    const hostname = window?.location?.hostname;
    if (hostname === "coda.fit.nasa.gov") {
      script.src = "https://pulse.nasa.gov/track.js";
    } else {
      script.src = "https://pulse.staging.nasa.gov/track.js";
    }

    document.body.appendChild(script);
    script.onload = () => {
      makePulseTrackCall();
    };
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  return <></>;
};

export default PulseAnyatics;
