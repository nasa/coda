import '../styles.css'
import VideosContext from '../contexts/videos';

// This default export is required in a new `pages/_app.js` file.
export default function App({ Component, pageProps }) {
  return (
    // <VideosContext.Provider>
      <Component {...pageProps} />
    // </VideosContext.Provider>
  )
}
