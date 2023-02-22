import Script from "next/script";
import { FunctionComponent } from "react";

const PulseAnyatics: FunctionComponent = () => {
  return (
    <>
      <Script strategy="beforeInteractive">
        {`function makePulseTrackCall() {
          try {
            Pulse.track("CODA", { auid: "" }); //coda doesn't have auth to track username
          } catch (e) {
            console.log("Pulse tracking error: " + e);
          }
        }`}
      </Script>
      {
        /**
         * The IMAGE_VERSION environment variable is set in the .gitlab-ci.yml file, and is normally used to determine
         * the deployment environment of the CI/CD pipeline. We use it here to determine which Pulse Analytics script to load.
         * Note: if you run a pipeline for prod but then also deploy it to dev, that dev server will identify itself as prod and
         * analytics will be sent to the prod Pulse Analytics server. This is not a problem, but it is something to be aware of.
         *
         * Strategy needs to be beforeInteractive to make sure this loads before the event/log calls on the routes
         * add "?sleep=10" URL parameter to track.js to simulate a slow load by 10 seconds
         */
        process.env.IMAGE_VERSION === "prod" ? (
          <Script src="https://pulse.nasa.gov/track.js" strategy="beforeInteractive" async />
        ) : (
          <Script
            src="https://pulse.staging.nasa.gov/track.js"
            strategy="beforeInteractive"
            async
          />
        )
      }
    </>
  );
};

export default PulseAnyatics;
