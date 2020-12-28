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
  const store = useStore(pageProps.initialReduxState);

  return (
    <Provider store={store}>
      <Component {...pageProps} />
    </Provider>
  )
}
