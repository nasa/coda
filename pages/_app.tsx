import type { AppProps } from "next/app";
import { wrapper } from "../store";
import "../styles.css";
import PulseAnyatics from "components/pulse";

// The following import prevents a Font Awesome icon server-side rendering bug,
// where the icons flash from a very large icon down to a properly sized one:
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";

const App = ({ Component, pageProps }: AppProps) => {
  config.autoAddCss = false; // Tell Font Awesome to skip adding the CSS automatically since we did it manually above.

  return (
    <>
      <PulseAnyatics />
      <Component {...pageProps} />
    </>
  );
};

export default wrapper.withRedux(App);
