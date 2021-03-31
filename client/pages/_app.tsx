import clone from "lodash/clone";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { useStore, initialState } from "store";
import "../styles.css";

// Enable API mocking locally in node
// https://github.com/vercel/next.js/tree/canary/examples/with-msw
if (typeof window === "undefined" && process.env.NEXT_PUBLIC_APP_ENV === "local") {
  require("../mocks");
}

// This default export is required in a new `pages/_app.js` file.
export default function App({ Component, pageProps }: AppProps) {
  console.log("deleteme");
  const store = useStore(clone(initialState));

  return (
    <Provider store={store}>
      <Component {...pageProps} />
    </Provider>
  );
}
