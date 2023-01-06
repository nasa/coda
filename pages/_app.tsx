import type { AppProps } from "next/app";
import { wrapper } from "../store";
import "../styles.css";

// The following import prevents a Font Awesome icon server-side rendering bug,
// where the icons flash from a very large icon down to a properly sized one:
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import Script from "next/script";

const App = ({ Component, pageProps }: AppProps) => {
  config.autoAddCss = false; // Tell Font Awesome to skip adding the CSS automatically since we did it manually above.

  return (
    <>
      <Component {...pageProps} />;
      {process.env.NEXT_PUBLIC_APP_ENV === "production" ? (
        <Script src="https://pulse.nasa.gov/track.js" />
      ) : (
        <Script src="https://pulse.staging.nasa.gov/track.js" />
      )}
      <Script src="../public/pulseAnalytics.js" />
    </>
  );
};

export default wrapper.withRedux(App);
