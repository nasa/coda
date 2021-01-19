import Head from "next/head";
import { Provider } from "react-redux";
import { useStore } from "store";
import '../styles.css';

// Enable API mocking locally
// https://github.com/vercel/next.js/tree/canary/examples/with-msw
if (process.env.APP_ENV === 'local') {
  require('../mocks');
}

// This default export is required in a new `pages/_app.js` file.
export default function App({ Component, pageProps }) {
  const stateFromServer = pageProps.initialReduxState;
  // set lastStarted so the clock is running when CODA loads
  // we also need to set applicationTime on the server-side, see [eva].tsx
  if (stateFromServer) {
    stateFromServer.clock.lastStarted = new Date().toISOString();
  }
  const store = useStore(stateFromServer);

  return (
    <Provider store={store}>
      <Head>
        <meta charSet="utf-8" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
        <link rel="manifest" href="/favicon/site.webmanifest" />
        <link rel="mask-icon" href="/favicon/safari-pinned-tab.svg" color="#5bbad5" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap"
          rel="stylesheet"
        ></link>
      </Head>
      <Component {...pageProps} />
    </Provider>
  )
}
