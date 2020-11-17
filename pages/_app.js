import '../styles.css'
import VideosContext from '../contexts/videos';

// Enable API mocking locally
// https://github.com/vercel/next.js/tree/canary/examples/with-msw
if (process.env.APP_ENV === 'local') {
  require('../mocks');
}

// This default export is required in a new `pages/_app.js` file.
export default function App({ Component, pageProps }) {
  return (
    // <VideosContext.Provider>
      <Component {...pageProps} />
    // </VideosContext.Provider>
  )
}
