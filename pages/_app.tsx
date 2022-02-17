import clone from "lodash/clone";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { useStore, initialState } from "store";
import "../styles.css";

// The following import prevents a Font Awesome icon server-side rendering bug,
// where the icons flash from a very large icon down to a properly sized one:
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";

import "/public/team-accordion-styles.css";

// This default export is required in a new `pages/_app.js` file.
export default function App({ Component, pageProps }: AppProps) {
  config.autoAddCss = false; // Tell Font Awesome to skip adding the CSS automatically since we did it manually above.

  const store = useStore(clone(initialState));

  return (
    <Provider store={store}>
      <Component {...pageProps} />
    </Provider>
  );
}
