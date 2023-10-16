import "../styles.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import type { AppProps } from "next/app";
import { wrapper } from "../store";
import { config } from "@fortawesome/fontawesome-svg-core";
import { Provider } from "react-redux";
import PulseAnyatics from "components/pulse";

function App({ Component, ...rest }: AppProps): JSX.Element {
  const { store, props } = wrapper.useWrappedStore(rest);
  const { pageProps } = props;
  config.autoAddCss = false; // Tell Font Awesome to skip adding the CSS automatically since we did it manually above.
  return (
    <Provider store={store}>
      <Component {...pageProps} />
      <PulseAnyatics />
    </Provider>
  );
}

export default App;