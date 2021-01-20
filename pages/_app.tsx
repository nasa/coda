import clone from "lodash/clone";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { useStore } from "store";
import "../styles.css";

// Enable API mocking locally
// https://github.com/vercel/next.js/tree/canary/examples/with-msw
if (process.env.APP_ENV === "local") {
  require("../mocks");
}

// This default export is required in a new `pages/_app.js` file.
export default function App({ Component, pageProps }: AppProps) {
  const stateFromServer = pageProps.initialReduxState;
  // set lastStarted so the clock is running when CODA loads
  // we also need to set applicationTime on the server-side, see [eva].tsx
  if (stateFromServer) {
    stateFromServer.clock.lastStarted = new Date().toISOString();
  }
  const store = useStore(clone(stateFromServer));

  return (
    <Provider store={store}>
      <Component {...pageProps} />
    </Provider>
  );
}
