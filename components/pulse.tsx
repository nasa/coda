import { pulseTrack } from "../public/pulseAnalytics.js";
import Script from "next/script";
import { FunctionComponent } from "react";
declare var Pulse: any;

const PulseAnyatics: FunctionComponent = () => {
  return (
    <>
      {
        /**
         * The IMAGE_VERSION environment variable is set in the .gitlab-ci.yml file, and is normally used to determine
         * the deployment environment of the CI/CD pipeline. We use it here to determine which Pulse Analytics script to load.
         * Note: if you run a pipeline for prod but then also deploy it to dev, that dev server will identify itself as prod and
         * analytics will be sent to the prod Pulse Analytics server. This is not a problem, but it is something to be aware of.
         *
         * Strategy needs to be beforeInteractive to make sure this loads before the event/log calls on the routes
         */
        process.env.IMAGE_VERSION === "prod" ? (
          <Script
            src="https://pulse.nasa.gov/track.js"
            strategy="beforeInteractive"
            onReady={() => {
              try {
                pulseTrack(Pulse);
              } catch (e) {
                console.log("Pulse Script Error: " + e);
              }
            }}
          />
        ) : (
          <Script
            src="https://pulse.broken.staging.nasa.gov/track.js"
            strategy="beforeInteractive"
            onReady={() => {
              try {
                pulseTrack(Pulse);
              } catch (e) {
                console.log("Pulse Script Error: " + e);
              }
            }}
          />
        )
      }
    </>
  );
};

export default PulseAnyatics;
